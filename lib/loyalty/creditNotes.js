// Credit notes and point reversals (spec section 9, RET-01..08).
import { CATEGORY_TRADE, WALK_IN, categoryName } from "./constants.js";
import { calcPoints, parseScaled, formatScaled, VALUE_SCALE, QTY_SCALE } from "./money.js";
import { resolveSiteCode } from "./sites.js";
import { drawFromLots, recordDebit, spendableLots } from "./ledger.js";
import { notifyPartner, notifyStaff } from "./notify.js";

function classifyCreditLine(line) {
  if (line.siteCode === WALK_IN) return { status: "NO_POINTS" };
  if (line.issues.includes("MISSING_CATEGORY")) return { status: "EXCEPTION", reason: "MISSING_CATEGORY" };
  if (line.issues.includes("INVALID_CATEGORY")) return { status: "EXCEPTION", reason: "INVALID_CATEGORY" };
  if (line.issues.includes("INVALID_VALUE")) return { status: "EXCEPTION", reason: "INVALID_VALUE" };
  return { status: "OK" };
}

const lotScale = (lot) => (lot.basisType === "QUANTITY" ? QTY_SCALE : VALUE_SCALE);

/** Points a lot is entitled to for a given net basis, using the lot's own rate and multiplier (RET-03). */
function entitled(lot, netBasisScaled) {
  return calcPoints({ basisScaled: netBasisScaled, basisScale: lotScale(lot), ratePoints: lot.ratePoints, ratePer: lot.ratePer, multiplier: lot.multiplier });
}

/**
 * Reverse points for one returned line against the lots of its original invoice + category.
 * Reversal = points before the return − points on the net amount after it, so a full return
 * always reverses exactly what was credited, and the result matches netting before payment.
 */
export async function applyCreditLine(tx, { creditLine, invoice, settings, now, userId = null }) {
  const lots = (await tx.findLotsForInvoice(invoice.id)).filter((l) => l.category === creditLine.category);
  if (!lots.length) {
    // Is the original line still waiting in exceptions? Then wait for it (it will be netted).
    const waiting = (await tx.findInvoiceLines(invoice.id)).some((l) => l.status === "EXCEPTION" && (l.category === creditLine.category || l.category === null));
    return { status: waiting ? "PENDING_INVOICE" : "NO_POINTS", points: 0 };
  }

  let candidates = lots;
  if (lots.length > 1 && creditLine.siteCode) {
    const site = await resolveSiteCode(tx, creditLine.siteCode);
    const sameSite = site ? lots.filter((l) => l.siteId === site.id) : [];
    if (sameSite.length) candidates = sameSite;
  }
  candidates = [...candidates].sort((a, b) => a.id - b.id);

  const partnerId = candidates[0].partnerId; // RET-02: always the partner who earned it
  await tx.lockPartner(partnerId);
  const partner = await tx.getPartner(partnerId);

  let toReverse = 0;
  const perLot = [];
  let remainingReturn = null;
  let taxLeft = parseScaled(creditLine.taxableValue, VALUE_SCALE) ?? 0n;
  for (const lot of candidates) {
    const scale = lotScale(lot);
    if (remainingReturn === null) {
      remainingReturn = parseScaled(lot.basisType === "QUANTITY" ? creditLine.quantity : creditLine.taxableValue, scale) ?? 0n;
    }
    if (remainingReturn <= 0n) break;
    const basis = parseScaled(lot.basis, scale);
    const returned = parseScaled(lot.returnedBasis ?? "0", scale);
    const open = basis - returned;
    if (open <= 0n) continue;
    const take = remainingReturn < open ? remainingReturn : open;
    const before = entitled(lot, open);
    const after = entitled(lot, open - take);
    const pts = before - after;
    const lotTaxable = parseScaled(lot.taxableValue, VALUE_SCALE) ?? 0n;
    const taxTake = taxLeft < lotTaxable ? taxLeft : lotTaxable;
    taxLeft -= taxTake;
    await tx.updateLot(lot.id, {
      returnedBasis: formatScaled(returned + take, scale),
      taxableValue: formatScaled(lotTaxable - taxTake, VALUE_SCALE),
    });
    lot.returnedBasis = formatScaled(returned + take, scale);
    perLot.push({ lot, pts });
    toReverse += pts;
    remainingReturn -= take;
  }

  if (toReverse <= 0) return { status: "REVERSED", points: 0, partner };

  // RET-04: first from this invoice's own lot(s), then from Available points, oldest first.
  const parts = [];
  let taken = 0;
  for (const { lot, pts } of perLot) {
    if (pts <= 0) continue;
    const fresh = await tx.getLot(lot.id);
    const r = await drawFromLots(tx, [fresh], pts, "reversedPoints");
    parts.push(...r.parts);
    taken += r.taken;
  }
  let shortfall = toReverse - taken;
  if (shortfall > 0) {
    const others = (await spendableLots(tx, partnerId, now)).filter((l) => !perLot.some((p) => p.lot.id === l.id));
    const r = await drawFromLots(tx, others, shortfall, "reversedPoints");
    parts.push(...r.parts);
    taken += r.taken;
    shortfall -= r.taken;
  }

  const ledger = await recordDebit(tx, {
    partnerId,
    type: "REVERSAL",
    parts,
    taken,
    note: shortfall > 0 ? `Return ${creditLine.creditNoteNumber}: ${shortfall} points could not be covered by the balance` : `Return ${creditLine.creditNoteNumber}`,
    createdById: userId,
    refs: { invoiceId: invoice.id, creditNoteId: creditLine.creditNoteId, siteId: candidates[0].siteId, category: creditLine.category },
  });

  // RET-08: balance never goes below zero; the rest follows the Owner's configured policy (Q3).
  if (shortfall > 0) {
    const policy = settings.values.shortfallPolicy;
    await tx.createShortfall({ partnerId, creditNoteLineId: creditLine.id, points: shortfall, policy, status: "OPEN" });
    if (policy === "CARRY_FORWARD") {
      await tx.updatePartner(partnerId, { pendingDeduction: (partner.pendingDeduction || 0) + shortfall });
    }
    await notifyStaff(tx, "STAFF_SHORTFALL", { partnerCode: partner.code, points: shortfall, policy });
  }

  const site = await tx.getSite(candidates[0].siteId);
  const unitText = candidates[0].basisType === "QUANTITY" ? `${trimQty(creditLine.quantity)} ${creditLine.unit || "units"}` : `₹${creditLine.taxableValue}`;
  if (taken > 0) {
    await notifyPartner(tx, partner, "POINTS_REVERSED", { siteCode: site?.code ?? "", category: creditLine.category, returned: unitText, points: taken });
  }
  return { status: "REVERSED", points: taken, shortfall, partner, ledgerId: ledger?.id ?? null };
}

const trimQty = (q) => String(q).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

export async function processCreditNoteDocument(tx, { number, lines, batch, settings, now, userId = null }) {
  if (await tx.findCreditNoteByNumber(number)) return { skipped: true, number };
  const originalInvoiceNumber = lines[0].originalInvoiceNumber;
  const noteDate = lines.find((l) => l.noteDate)?.noteDate ?? null;
  const result = { number, skipped: false, lines: lines.length, exceptions: 0, ignored: 0, pending: 0, reversed: [] };

  if (!noteDate) {
    for (const l of lines) {
      await tx.createException({ uploadBatchId: batch.id, kind: "CREDIT_NOTE", documentNumber: number, rowNumber: l.rowNumber, reason: "INVALID_DATE", raw: l.raw, status: "OPEN" });
    }
    result.exceptions = lines.length;
    return result;
  }

  const invoice = await tx.findInvoiceByNumber(originalInvoiceNumber);
  const classified = lines.map((l) => ({ line: l, c: classifyCreditLine(l) }));
  const note = await tx.createCreditNote({
    number,
    noteDate,
    originalInvoiceNumber,
    status: invoice ? "APPLIED" : "PENDING_INVOICE",
    uploadBatchId: batch.id,
    lines: classified.map(({ line, c }) => ({
      rowNumber: line.rowNumber,
      siteCodeRaw: line.siteCode || null,
      itemName: line.itemName,
      categoryRaw: line.categoryRaw || null,
      category: line.category,
      quantity: line.quantity ?? "0",
      unit: line.unit || null,
      taxableValue: line.taxableValue ?? "0",
      status: c.status === "OK" ? (invoice ? "NO_POINTS" : "PENDING_INVOICE") : c.status,
      originalInvoiceNumber,
    })),
  });

  for (let i = 0; i < classified.length; i++) {
    const { line, c } = classified[i];
    const dbLine = note.lines[i];
    if (c.status === "NO_POINTS") {
      result.ignored++;
      continue;
    }
    if (c.status === "EXCEPTION") {
      result.exceptions++;
      await tx.createException({ uploadBatchId: batch.id, kind: "CREDIT_NOTE", creditNoteLineId: dbLine.id, documentNumber: number, rowNumber: line.rowNumber, reason: c.reason, raw: line.raw, status: "OPEN" });
      continue;
    }
    if (!invoice) {
      result.pending++;
      continue; // stored as PENDING_INVOICE; netted when the invoice is uploaded (RET-07)
    }
    const r = await applyCreditLine(tx, {
      creditLine: { ...dbLine, siteCode: line.siteCode, creditNoteNumber: number, creditNoteId: note.id },
      invoice,
      settings,
      now,
      userId,
    });
    await tx.updateCreditNoteLine(dbLine.id, { status: r.status, pointsReversed: r.points });
    if (r.status === "PENDING_INVOICE") result.pending++;
    if (r.points > 0) result.reversed.push({ partnerId: r.partner.id, partnerCode: r.partner.code, points: r.points, shortfall: r.shortfall || 0, category: line.category, categoryName: categoryName(line.category) });
  }
  return result;
}

export { CATEGORY_TRADE };
