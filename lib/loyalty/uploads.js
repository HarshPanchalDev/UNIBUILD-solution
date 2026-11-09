// Daily BUSY upload (spec 8.3). Header check first (UPL-02), then each document in its own
// transaction. Re-uploading a file never credits twice (UPL-03).
import { parseInvoiceRows, parseCreditNoteRows, groupByDocument } from "../busy/parse.js";
import { processInvoiceDocument } from "./invoices.js";
import { processCreditNoteDocument } from "./creditNotes.js";
import { getActiveSettings } from "./settingsService.js";
import { audit } from "./notify.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Parse only — used for the preview step in the admin panel. Nothing is saved. */
export function previewUpload(kind, rows) {
  const parsed = kind === "INVOICE" ? parseInvoiceRows(rows) : parseCreditNoteRows(rows);
  if (!parsed.ok) return { ok: false, error: parsed.error, missing: parsed.missing };
  const docs = groupByDocument(parsed.lines);
  const issues = parsed.lines.filter((l) => l.issues.length).length;
  return {
    ok: true,
    lines: parsed.lines.length,
    documents: docs.size,
    linesWithIssues: issues,
    sample: parsed.lines.slice(0, 15).map((l) => ({ row: l.rowNumber, document: l.documentNumber, siteCode: l.siteCode, category: l.category, item: l.itemName, quantity: l.quantity, unit: l.unit, taxableValue: l.taxableValue, issues: l.issues })),
  };
}

const isUniqueViolation = (e) => e?.code === "P2002" || e?.code === "DUPLICATE";

export async function processUpload(repo, { kind, fileName, fileSize = 0, rows, userId, storageKey = null, ip = null, now = new Date() }) {
  const settings = await getActiveSettings(repo);
  const parsed = kind === "INVOICE" ? parseInvoiceRows(rows) : parseCreditNoteRows(rows);

  if (!parsed.ok) {
    const batch = await repo.createBatch({
      kind,
      fileName,
      fileSize,
      storageKey,
      status: "REJECTED",
      errorMessage: parsed.error,
      summary: { missingColumns: parsed.missing },
      settingsVersionId: settings.id,
      uploadedById: userId,
    });
    await audit(repo, { userId, action: "UPLOAD_REJECTED", entityType: "UploadBatch", entityId: batch.id, after: { fileName, kind, error: parsed.error }, ip });
    return { batch, rejected: true, error: parsed.error, missing: parsed.missing };
  }

  const batch = await repo.createBatch({ kind, fileName, fileSize, storageKey, status: "PROCESSED", settingsVersionId: settings.id, uploadedById: userId });
  const docs = groupByDocument(parsed.lines);
  const summary = {
    linesRead: parsed.lines.length,
    documentsProcessed: 0,
    documentsSkipped: 0,
    skippedNumbers: [],
    linesException: 0,
    linesIgnored: 0,
    linesUnlinked: 0,
    linesPending: 0,
    pointsCredited: 0,
    pointsReversed: 0,
    byPartner: {},
    failures: [],
  };
  const addPartner = (p, field, pts) => {
    const key = String(p.partnerId);
    summary.byPartner[key] ??= { partnerCode: p.partnerCode, partnerName: p.partnerName ?? null, credited: 0, reversed: 0 };
    summary.byPartner[key][field] += pts;
  };

  for (const [number, lines] of docs) {
    try {
      const res = await repo.transaction((tx) =>
        kind === "INVOICE"
          ? processInvoiceDocument(tx, { number, lines, batch, settings, now, userId })
          : processCreditNoteDocument(tx, { number, lines, batch, settings, now, userId })
      );
      if (res.skipped) {
        summary.documentsSkipped++;
        if (summary.skippedNumbers.length < 50) summary.skippedNumbers.push(number);
        continue;
      }
      summary.documentsProcessed++;
      summary.linesException += res.exceptions;
      summary.linesIgnored += res.ignored;
      if (kind === "INVOICE") {
        summary.linesUnlinked += res.unlinked;
        for (const c of res.credits) {
          summary.pointsCredited += c.points;
          addPartner(c, "credited", c.points);
        }
      } else {
        summary.linesPending += res.pending;
        for (const r of res.reversed) {
          summary.pointsReversed += r.points;
          addPartner(r, "reversed", r.points);
        }
      }
    } catch (e) {
      if (isUniqueViolation(e)) {
        summary.documentsSkipped++; // processed by a parallel upload a moment ago
        continue;
      }
      summary.failures.push({ number, error: e.message?.slice(0, 300) ?? "Unknown error" });
    }
  }

  const updated = await repo.updateBatch(batch.id, {
    linesRead: summary.linesRead,
    documentsProcessed: summary.documentsProcessed,
    documentsSkipped: summary.documentsSkipped,
    linesException: summary.linesException,
    linesIgnored: summary.linesIgnored,
    pointsCredited: summary.pointsCredited,
    pointsReversed: summary.pointsReversed,
    status: summary.failures.length && !summary.documentsProcessed && !summary.documentsSkipped ? "FAILED" : "PROCESSED",
    errorMessage: summary.failures.length ? `${summary.failures.length} document(s) failed to process` : null,
    summary,
  });
  await audit(repo, { userId, action: "UPLOAD_PROCESSED", entityType: "UploadBatch", entityId: batch.id, after: { fileName, kind, ...summary, byPartner: undefined, skippedNumbers: undefined }, ip });
  return { batch: updated, rejected: false, summary };
}
