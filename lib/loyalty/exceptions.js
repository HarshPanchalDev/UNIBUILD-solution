// Exceptions queue (spec 8.4). A line earns nothing until the Store Manager fixes and re-processes it.
import { invalid, notFound, conflict } from "./errors.js";
import { audit } from "./notify.js";
import { WALK_IN } from "./constants.js";
import { normalizeSiteCode, parseCategory } from "../busy/parse.js";
import { resolveSiteCode } from "./sites.js";
import { creditGroup } from "./invoices.js";
import { applyCreditLine } from "./creditNotes.js";
import { getSettingsById } from "./settingsService.js";

function pushHistory(ex, entry) {
  const h = Array.isArray(ex.history) ? ex.history : [];
  return [...h, entry].slice(-50);
}

/**
 * Re-process one exception after the cause is fixed.
 * fix: { siteCode?, category? } — corrected values (optional; the stored line is used otherwise).
 * Idempotent: a RESOLVED exception cannot be processed again, so points are credited once (T-04).
 */
export async function reprocessException(repo, { exceptionId, fix = {}, userId = null, ip = null, now = new Date() }) {
  return repo.transaction(async (tx) => {
    const ex = await tx.getException(exceptionId);
    if (!ex) throw notFound("Exception");
    if (ex.status !== "OPEN") throw conflict("This exception is already closed");
    if (!ex.invoiceLineId && !ex.creditNoteLineId) {
      throw invalid("This row has no valid invoice dates. Correct it in BUSY and upload the file again — it will close automatically.");
    }
    const batch = await tx.getBatch(ex.uploadBatchId);
    const settings = await getSettingsById(tx, batch?.settingsVersionId); // the rates of the original upload (T-14)

    const attempt = { at: now.toISOString(), by: userId, fix };
    let category;
    let outcome;

    if (ex.kind === "INVOICE") {
      const line = await tx.getInvoiceLine(ex.invoiceLineId);
      const code = normalizeSiteCode(fix.siteCode ?? line.siteCodeRaw);
      category = fix.category !== undefined && fix.category !== null && fix.category !== "" ? parseCategory(fix.category).value : line.category;
      if (code === WALK_IN) {
        await tx.updateInvoiceLine(line.id, { status: "WALK_IN", siteCodeRaw: WALK_IN });
        outcome = { status: "WALK_IN", points: 0 };
      } else {
        if (!code) throw invalid("Enter the Site Code for this line");
        if (!category) throw invalid("Enter a valid category (1–5) for this line");
        if (Number(line.taxableValue) < 0 || Number(line.quantity) < 0) throw invalid("Quantity or value is invalid — correct it in BUSY and re-upload");
        const site = await resolveSiteCode(tx, code);
        if (!site) {
          await tx.updateException(ex.id, { attempts: ex.attempts + 1, history: pushHistory(ex, { ...attempt, result: "UNKNOWN_SITE_CODE" }) });
          throw invalid(`Site Code ${code} is not in the app yet. Create the site (or merge it), then re-process.`);
        }
        await tx.updateInvoiceLine(line.id, { siteCodeRaw: code, siteId: site.id, category });
        const r = await creditGroup(tx, { invoice: line.invoice, site, category, lines: [{ ...line, category }], settings, now, userId });
        await tx.updateInvoiceLine(line.id, { status: r.status, lotId: r.lot?.id ?? null });
        outcome = { status: r.status, points: r.points, partnerCode: r.partner?.code ?? null };
      }
    } else {
      const line = await tx.getCreditNoteLine(ex.creditNoteLineId);
      category = fix.category !== undefined && fix.category !== null && fix.category !== "" ? parseCategory(fix.category).value : line.category;
      if (!category) throw invalid("Enter a valid category (1–5) for this line");
      await tx.updateCreditNoteLine(line.id, { category });
      const invoice = await tx.findInvoiceByNumber(line.originalInvoiceNumber);
      if (!invoice) {
        await tx.updateCreditNoteLine(line.id, { status: "PENDING_INVOICE" });
        outcome = { status: "PENDING_INVOICE", points: 0 };
      } else {
        const r = await applyCreditLine(tx, {
          creditLine: { ...line, category, siteCode: fix.siteCode ?? line.siteCodeRaw, creditNoteNumber: line.creditNote.number, creditNoteId: line.creditNoteId },
          invoice,
          settings,
          now,
          userId,
        });
        await tx.updateCreditNoteLine(line.id, { status: r.status, pointsReversed: r.points });
        outcome = { status: r.status, points: r.points };
      }
    }

    await tx.updateException(ex.id, {
      status: "RESOLVED",
      attempts: ex.attempts + 1,
      resolvedById: userId,
      resolvedAt: now,
      resolutionNote: `Re-processed: ${outcome.status}${outcome.points ? `, ${outcome.points} points` : ""}`,
      history: pushHistory(ex, { ...attempt, result: outcome.status, points: outcome.points }),
    });
    await audit(tx, { userId, action: "EXCEPTION_REPROCESS", entityType: "UploadException", entityId: ex.id, before: { status: "OPEN", reason: ex.reason }, after: { status: "RESOLVED", ...outcome, fix }, ip });
    return outcome;
  });
}

export async function dismissException(repo, { exceptionId, reason, userId = null, ip = null, now = new Date() }) {
  const why = String(reason ?? "").trim();
  if (why.length < 3) throw invalid("A reason is required to dismiss an exception");
  return repo.transaction(async (tx) => {
    const ex = await tx.getException(exceptionId);
    if (!ex) throw notFound("Exception");
    if (ex.status !== "OPEN") throw conflict("This exception is already closed");
    if (ex.invoiceLineId) await tx.updateInvoiceLine(ex.invoiceLineId, { status: "DISMISSED" });
    if (ex.creditNoteLineId) await tx.updateCreditNoteLine(ex.creditNoteLineId, { status: "DISMISSED" });
    await tx.updateException(ex.id, { status: "DISMISSED", resolvedById: userId, resolvedAt: now, resolutionNote: why.slice(0, 500), history: pushHistory(ex, { at: now.toISOString(), by: userId, result: "DISMISSED", reason: why }) });
    await audit(tx, { userId, action: "EXCEPTION_DISMISS", entityType: "UploadException", entityId: ex.id, reason: why, ip });
    return { status: "DISMISSED" };
  });
}
