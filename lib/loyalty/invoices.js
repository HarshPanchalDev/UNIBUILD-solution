// Paid-invoice processing (spec 7, 8.1, 8.4). One invoice = one transaction, so a bad
// invoice never blocks the rest of the file and nothing is ever half-credited.
import { CATEGORY_TRADE, WALK_IN, categoryName } from "./constants.js";
import { calcPoints, parseScaled, formatScaled, VALUE_SCALE, QTY_SCALE } from "./money.js";
import { resolveSiteCode } from "./sites.js";
import { creditLot } from "./ledger.js";
import { notifyPartner } from "./notify.js";

const sumScaled = (items, key, scale) => items.reduce((acc, i) => acc + (parseScaled(i[key], scale) ?? 0n), 0n);

/** Decide the first exception reason for a parsed line, or WALK_IN / OK. */
export function classifyInvoiceLine(line) {
  if (line.siteCode === WALK_IN) return { status: "WALK_IN" };
  if (line.issues.includes("MISSING_SITE_CODE")) return { status: "EXCEPTION", reason: "MISSING_SITE_CODE" };
  if (line.issues.includes("MISSING_CATEGORY")) return { status: "EXCEPTION", reason: "MISSING_CATEGORY" };
  if (line.issues.includes("INVALID_CATEGORY")) return { status: "EXCEPTION", reason: "INVALID_CATEGORY" };
  if (line.issues.includes("INVALID_VALUE")) return { status: "EXCEPTION", reason: "INVALID_VALUE" };
  return { status: "OK" };
}

/**
 * Credit one (invoice, site, category) group. Used by the upload and by exception re-processing.
 * Nets any credit notes that arrived before the invoice was paid (RET-07).
 * Returns { status: CREDITED | NO_PARTNER | NETTED_OUT, lot?, partner?, points }.
 */
export async function creditGroup(tx, { invoice, site, category, lines, settings, now, userId = null }) {
  const trade = CATEGORY_TRADE[category];
  const pendingAll = (await tx.findPendingCreditLines(invoice.number)).filter((c) => c.category === category);
  const noPartner = async (reason) => {
    // Returns against a line that earned nothing change nothing (RET-06)
    for (const c of pendingAll) await tx.updateCreditNoteLine(c.id, { status: "NO_POINTS" });
    return { status: "NO_PARTNER", points: 0, reason };
  };
  const link = await tx.findLinkCovering(site.id, trade, invoice.invoiceDate);
  if (!link) return noPartner("No partner of this trade linked on the invoice date");
  await tx.lockPartner(link.partnerId);
  const partner = await tx.getPartner(link.partnerId);
  if (!partner || partner.status !== "APPROVED") {
    return noPartner(`Linked partner is ${partner?.status?.toLowerCase() ?? "missing"}`);
  }

  const rate = settings.values.rates[category];
  const basisType = rate.basis;
  const basisScale = basisType === "QUANTITY" ? QTY_SCALE : VALUE_SCALE;
  let basis = sumScaled(lines, basisType === "QUANTITY" ? "quantity" : "taxableValue", basisScale);
  let taxable = sumScaled(lines, "taxableValue", VALUE_SCALE);

  // RET-07: credit notes received before this invoice was paid
  const pending = pendingAll;
  for (const c of pending) {
    basis -= parseScaled(basisType === "QUANTITY" ? c.quantity : c.taxableValue, basisScale) ?? 0n;
    taxable -= parseScaled(c.taxableValue, VALUE_SCALE) ?? 0n;
  }
  for (const c of pending) await tx.updateCreditNoteLine(c.id, { status: "APPLIED_NET" });
  if (basis <= 0n) return { status: "NETTED_OUT", points: 0, partner };
  if (taxable < 0n) taxable = 0n;

  const multiplier = settings.values.multipliers[partner.tier];
  const points = calcPoints({ basisScaled: basis, basisScale, ratePoints: rate.points, ratePer: rate.per, multiplier });
  if (points <= 0) return { status: "CREDITED", points: 0, partner };

  const { lot, recovered } = await creditLot(tx, {
    partner,
    settings,
    now,
    createdById: userId,
    lotData: {
      invoiceId: invoice.id,
      siteId: site.id,
      category,
      basisType,
      basis: formatScaled(basis, basisScale),
      returnedBasis: "0",
      taxableValue: formatScaled(taxable, VALUE_SCALE),
      ratePoints: String(rate.points),
      ratePer: String(rate.per),
      multiplier: String(multiplier),
      tier: partner.tier,
      points,
    },
  });
  await notifyPartner(tx, partner, "POINTS_CREDITED", {
    points,
    siteCode: site.code,
    category,
    unlockAt: lot.unlockAt instanceof Date ? lot.unlockAt.toISOString() : lot.unlockAt,
    invoiceNumber: undefined, // partners never see invoice data
  });
  return { status: "CREDITED", points, lot, partner, recovered, pendingNetted: pending.length };
}

/**
 * Process all lines of one invoice number from an upload. Caller wraps in a transaction.
 * Returns a per-invoice result used for the upload summary.
 */
export async function processInvoiceDocument(tx, { number, lines, batch, settings, now, userId = null }) {
  if (await tx.findInvoiceByNumber(number)) return { skipped: true, number };

  const invoiceDate = lines.find((l) => l.invoiceDate)?.invoiceDate ?? null;
  const paymentDate = lines.find((l) => l.paymentDate)?.paymentDate ?? null;
  const result = { number, skipped: false, lines: lines.length, exceptions: 0, ignored: 0, unlinked: 0, credits: [] };

  if (!invoiceDate || !paymentDate) {
    // Without dates the invoice cannot be checked against links; park all lines.
    for (const l of lines) {
      await tx.createException({
        uploadBatchId: batch.id,
        kind: "INVOICE",
        documentNumber: number,
        rowNumber: l.rowNumber,
        reason: "INVALID_DATE",
        raw: l.raw,
        status: "OPEN",
      });
    }
    result.exceptions = lines.length;
    result.noInvoice = true;
    return result;
  }

  // Classify and resolve sites
  const prepared = [];
  for (const l of lines) {
    let c = classifyInvoiceLine(l);
    let site = null;
    if (c.status === "OK") {
      site = await resolveSiteCode(tx, l.siteCode);
      if (!site) c = { status: "EXCEPTION", reason: "UNKNOWN_SITE_CODE" };
    }
    prepared.push({ line: l, c, site });
  }

  const invoice = await tx.createInvoice({
    number,
    invoiceDate,
    paymentDate,
    uploadBatchId: batch.id,
    lines: prepared.map(({ line, c, site }) => ({
      rowNumber: line.rowNumber,
      siteCodeRaw: line.siteCode || null,
      siteId: site?.id ?? null,
      itemName: line.itemName,
      categoryRaw: line.categoryRaw || null,
      category: line.category,
      quantity: line.quantity ?? "0",
      unit: line.unit || null,
      taxableValue: line.taxableValue ?? "0",
      status: c.status === "OK" ? "NO_PARTNER" : c.status, // updated below once credited
    })),
  });

  const groups = new Map();
  for (let i = 0; i < prepared.length; i++) {
    const { line, c, site } = prepared[i];
    const dbLine = invoice.lines[i];
    if (c.status === "WALK_IN") {
      result.ignored++;
      continue;
    }
    if (c.status === "EXCEPTION") {
      result.exceptions++;
      await tx.createException({
        uploadBatchId: batch.id,
        kind: "INVOICE",
        invoiceLineId: dbLine.id,
        documentNumber: number,
        rowNumber: line.rowNumber,
        reason: c.reason,
        raw: line.raw,
        status: "OPEN",
      });
      continue;
    }
    const key = `${site.id}:${line.category}`;
    if (!groups.has(key)) groups.set(key, { site, category: line.category, lines: [] });
    groups.get(key).lines.push({ ...line, dbLineId: dbLine.id });
  }

  for (const g of groups.values()) {
    const r = await creditGroup(tx, { invoice, site: g.site, category: g.category, lines: g.lines, settings, now, userId });
    const status = r.status === "CREDITED" ? "CREDITED" : r.status;
    for (const l of g.lines) await tx.updateInvoiceLine(l.dbLineId, { status, lotId: r.lot?.id ?? null });
    if (r.status === "NO_PARTNER") result.unlinked += g.lines.length;
    if (r.points > 0) {
      result.credits.push({ partnerId: r.partner.id, partnerCode: r.partner.code, partnerName: r.partner.name, siteCode: g.site.code, category: g.category, categoryName: categoryName(g.category), points: r.points, lotId: r.lot.id });
    }
  }

  // An invoice that failed earlier for bad dates is now in: close those exceptions.
  await tx.resolveExceptionsByDocument("INVOICE", number, "INVALID_DATE", { status: "RESOLVED", resolutionNote: `Re-uploaded in batch #${batch.id}`, resolvedAt: now, resolvedById: userId });
  return result;
}
