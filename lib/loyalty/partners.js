// Partner approval, suspension, tiers and owner adjustments (spec 6.1, ADM-01).
import { TRADE_CODE, TIERS, TIER_LABEL } from "./constants.js";
import { invalid, notFound, conflict } from "./errors.js";
import { audit, notifyPartner } from "./notify.js";
import { creditLot, drawFromLots, recordDebit, spendableLots } from "./ledger.js";
import { sortOldestFirst } from "./balance.js";

const reasonOf = (reason, what) => {
  const r = String(reason ?? "").trim();
  if (r.length < 3) throw invalid(`A reason is required to ${what}`);
  return r.slice(0, 500);
};

/** PRT-03: approve and issue a permanent Partner Code (UBP-CO-0001…). */
export async function approvePartner(repo, { partnerId, userId = null, ip = null, now = new Date() }) {
  return repo.transaction(async (tx) => {
    await tx.lockPartner(partnerId);
    const p = await tx.getPartner(partnerId);
    if (!p) throw notFound("Partner");
    if (p.status !== "PENDING") throw conflict(`Partner is ${p.status.toLowerCase()}, not pending`);
    let code = p.code;
    if (!code) {
      const prefix = `UBP-${TRADE_CODE[p.trade]}`;
      const n = await tx.nextSequence(prefix);
      code = `${prefix}-${String(n).padStart(4, "0")}`;
    }
    const updated = await tx.updatePartner(partnerId, { status: "APPROVED", code, approvedAt: now, approvedById: userId, statusReason: null });
    await audit(tx, { userId, action: "PARTNER_APPROVE", entityType: "Partner", entityId: partnerId, before: { status: p.status }, after: { status: "APPROVED", code }, ip });
    await notifyPartner(tx, updated, "PARTNER_APPROVED", { code });
    return updated;
  });
}

export async function rejectPartner(repo, { partnerId, reason, userId = null, ip = null }) {
  const why = reasonOf(reason, "reject a registration");
  return repo.transaction(async (tx) => {
    const p = await tx.getPartner(partnerId);
    if (!p) throw notFound("Partner");
    if (p.status !== "PENDING") throw conflict("Only pending registrations can be rejected");
    const updated = await tx.updatePartner(partnerId, { status: "REJECTED", statusReason: why });
    await audit(tx, { userId, action: "PARTNER_REJECT", entityType: "Partner", entityId: partnerId, before: { status: p.status }, after: { status: "REJECTED" }, reason: why, ip });
    await notifyPartner(tx, updated, "PARTNER_REJECTED", { reason: why });
    return updated;
  });
}

/** PRT-05: suspended partners earn nothing new; existing points stay but cannot be redeemed. */
export async function suspendPartner(repo, { partnerId, reason, userId = null, ip = null }) {
  const why = reasonOf(reason, "suspend a partner");
  return repo.transaction(async (tx) => {
    const p = await tx.getPartner(partnerId);
    if (!p) throw notFound("Partner");
    if (p.status !== "APPROVED") throw conflict("Only approved partners can be suspended");
    const updated = await tx.updatePartner(partnerId, { status: "SUSPENDED", statusReason: why });
    await audit(tx, { userId, action: "PARTNER_SUSPEND", entityType: "Partner", entityId: partnerId, before: { status: p.status }, after: { status: "SUSPENDED" }, reason: why, ip });
    await notifyPartner(tx, updated, "PARTNER_SUSPENDED", { reason: why });
    return updated;
  });
}

export async function reinstatePartner(repo, { partnerId, reason, userId = null, ip = null }) {
  const why = reasonOf(reason, "reinstate a partner");
  return repo.transaction(async (tx) => {
    const p = await tx.getPartner(partnerId);
    if (!p) throw notFound("Partner");
    if (p.status !== "SUSPENDED") throw conflict("Only suspended partners can be reinstated");
    const updated = await tx.updatePartner(partnerId, { status: "APPROVED", statusReason: null });
    await audit(tx, { userId, action: "PARTNER_REINSTATE", entityType: "Partner", entityId: partnerId, before: { status: p.status }, after: { status: "APPROVED" }, reason: why, ip });
    await notifyPartner(tx, updated, "PARTNER_REINSTATED", {});
    return updated;
  });
}

/** Owner: set a tier by hand (e.g. before quarterly thresholds are decided). */
export async function setPartnerTier(repo, { partnerId, tier, reason, userId = null, ip = null, settings }) {
  const why = reasonOf(reason, "change a tier");
  if (!TIERS.includes(tier)) throw invalid("Unknown tier");
  return repo.transaction(async (tx) => {
    const p = await tx.getPartner(partnerId);
    if (!p) throw notFound("Partner");
    if (p.tier === tier) throw invalid(`Partner is already ${TIER_LABEL[tier]}`);
    const updated = await tx.updatePartner(partnerId, { tier });
    await tx.createTierHistory({ partnerId, fromTier: p.tier, toTier: tier, reason: why, createdById: userId });
    await audit(tx, { userId, action: "PARTNER_TIER", entityType: "Partner", entityId: partnerId, before: { tier: p.tier }, after: { tier }, reason: why, ip });
    await notifyPartner(tx, updated, "TIER_CHANGED", { tier, tierLabel: TIER_LABEL[tier], multiplier: settings.values.multipliers[tier] });
    return updated;
  });
}

/**
 * ADM-01: owner-only manual adjustment with a reason the partner sees.
 * Positive = new Available lot. Negative = taken from Available then Locked points; never below zero.
 */
export async function adjustPoints(repo, { partnerId, points, reason, userId = null, ip = null, now = new Date(), settings }) {
  const why = reasonOf(reason, "adjust points");
  const pts = Number(points);
  if (!Number.isInteger(pts) || pts === 0 || Math.abs(pts) > 1000000) throw invalid("Points must be a whole number, positive or negative, not zero");
  return repo.transaction(async (tx) => {
    await tx.lockPartner(partnerId);
    const partner = await tx.getPartner(partnerId);
    if (!partner) throw notFound("Partner");
    if (partner.status === "PENDING" || partner.status === "REJECTED") throw invalid("Approve the partner before adjusting points");
    let entryId;
    if (pts > 0) {
      const { lot } = await creditLot(tx, {
        partner: { ...partner, pendingDeduction: 0 },
        settings,
        now,
        createdById: userId,
        ledgerType: "ADJUSTMENT",
        unlockImmediately: true,
        note: why,
        lotData: { basisType: "ADJUSTMENT", tier: partner.tier, points: pts, ratePoints: "0", ratePer: "1", multiplier: "1", basis: "0", returnedBasis: "0", taxableValue: "0" },
      });
      entryId = lot.id;
    } else {
      const need = -pts;
      const available = await spendableLots(tx, partnerId, now);
      const lockedLots = sortOldestFirst((await tx.findPartnerLots(partnerId, { withRemaining: true })).filter((l) => new Date(l.unlockAt) > now && new Date(l.expiresAt) > now));
      const total = [...available, ...lockedLots].reduce((s, l) => s + l.remaining, 0);
      if (total < need) throw invalid(`Partner has only ${total} points; the balance cannot go below zero`);
      const r = await drawFromLots(tx, [...available, ...lockedLots], need, "adjustedPoints");
      const e = await recordDebit(tx, { partnerId, type: "ADJUSTMENT", parts: r.parts, taken: r.taken, note: why, createdById: userId });
      entryId = e.id;
    }
    await audit(tx, { userId, action: "POINTS_ADJUST", entityType: "Partner", entityId: partnerId, after: { points: pts }, reason: why, ip });
    await notifyPartner(tx, partner, "POINTS_ADJUSTED", { points: pts, reason: why });
    return { ok: true, id: entryId };
  });
}
