// Ledger operations. Every balance change = one LedgerEntry + LotAllocation rows.
// Callers must run these inside repo.transaction() and lock the partner first.
import { sortOldestFirst, isSpendable } from "./balance.js";
import { addDays, addMonths } from "./dates.js";

/**
 * Take `points` out of lots in the given order. Mutates lots in the DB.
 * `field` is the counter on the lot to increase (redeemedPoints | reversedPoints | expiredPoints | adjustedPoints).
 * Returns { taken, parts: [{lotId, points}] }.
 */
export async function drawFromLots(tx, lots, points, field) {
  let need = points;
  const parts = [];
  for (const lot of lots) {
    if (need <= 0) break;
    if (lot.remaining <= 0) continue;
    const take = Math.min(lot.remaining, need);
    await tx.updateLot(lot.id, { remaining: lot.remaining - take, [field]: (lot[field] || 0) + take });
    lot.remaining -= take;
    lot[field] = (lot[field] || 0) + take;
    parts.push({ lotId: lot.id, points: take });
    need -= take;
  }
  return { taken: points - need, parts };
}

export async function recordDebit(tx, { partnerId, type, parts, taken, note = null, createdById = null, refs = {} }) {
  if (taken <= 0) return null;
  const entry = await tx.createLedgerEntry({ partnerId, type, points: -taken, note, createdById, ...refs });
  for (const p of parts) await tx.createAllocation({ lotId: p.lotId, ledgerEntryId: entry.id, points: p.points });
  return entry;
}

/** Spendable (Available) lots for a partner, oldest first. */
export async function spendableLots(tx, partnerId, now) {
  const lots = await tx.findPartnerLots(partnerId, { withRemaining: true });
  return sortOldestFirst(lots.filter((l) => isSpendable(l, now)));
}

/** Create a lot + CREDIT entry. Applies any carried-forward return shortfall first. */
export async function creditLot(tx, { partner, settings, now, lotData, note = null, createdById = null, ledgerType = "CREDIT", unlockImmediately = false }) {
  const unlockAt = unlockImmediately ? now : addDays(now, settings.values.lockDays);
  const expiresAt = addMonths(now, settings.values.expiryMonths);
  const lot = await tx.createLot({
    partnerId: partner.id,
    trade: partner.trade,
    remaining: lotData.points,
    creditedAt: now,
    unlockAt,
    expiresAt,
    settingsVersionId: settings.id,
    ...lotData,
  });
  await tx.createLedgerEntry({
    partnerId: partner.id,
    type: ledgerType,
    points: lotData.points,
    lotId: lot.id,
    invoiceId: lotData.invoiceId ?? null,
    siteId: lotData.siteId ?? null,
    category: lotData.category ?? null,
    note,
    createdById,
  });

  // Recover a carried-forward shortfall (CARRY_FORWARD policy) from the new points.
  let recovered = 0;
  if (partner.pendingDeduction > 0 && lot.remaining > 0) {
    const { taken, parts } = await drawFromLots(tx, [lot], Math.min(partner.pendingDeduction, lot.remaining), "reversedPoints");
    await recordDebit(tx, {
      partnerId: partner.id,
      type: "REVERSAL",
      parts,
      taken,
      note: "Recovery of an earlier return that the balance could not cover",
      refs: { lotId: lot.id },
    });
    recovered = taken;
    partner.pendingDeduction -= taken;
    await tx.updatePartner(partner.id, { pendingDeduction: partner.pendingDeduction });
    let left = taken;
    for (const s of await tx.findOpenShortfalls(partner.id)) {
      if (left <= 0) break;
      if (s.policy !== "CARRY_FORWARD") continue;
      const outstanding = s.points - (s.recoveredPoints || 0);
      const use = Math.min(outstanding, left);
      left -= use;
      await tx.updateShortfall(s.id, use === outstanding ? { status: "RECOVERED", recoveredPoints: s.points } : { recoveredPoints: (s.recoveredPoints || 0) + use });
    }
  }
  return { lot, recovered };
}
