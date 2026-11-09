// Redemptions (spec 10, 11; T-13). Points are taken when the request is made so two requests
// at the same time can never spend the same points; a rejection returns them to the same lots.
import { invalid, notFound, conflict } from "./errors.js";
import { audit, notifyPartner, notifyStaff } from "./notify.js";
import { drawFromLots, recordDebit, spendableLots } from "./ledger.js";

export async function requestRedemption(repo, { partnerId, rewardId, notes = "", now = new Date(), settings }) {
  return repo.transaction(async (tx) => {
    await tx.lockPartner(partnerId); // serialize concurrent requests by the same partner
    const partner = await tx.getPartner(partnerId);
    if (!partner) throw notFound("Partner");
    if (partner.status === "SUSPENDED") throw invalid("Your account is suspended. Points cannot be redeemed until it is reinstated.", { code: "SUSPENDED" });
    if (partner.status !== "APPROVED") throw invalid("Your registration is not approved yet.", { code: "NOT_APPROVED" });
    const reward = await tx.getReward(rewardId);
    if (!reward || reward.status !== "ACTIVE") throw invalid("This reward is not available", { code: "REWARD_UNAVAILABLE" });

    const lots = await spendableLots(tx, partnerId, now);
    const available = lots.reduce((s, l) => s + l.remaining, 0);
    const min = settings.values.minRedeem;
    if (available < min) throw invalid(`You need at least ${min} available points to redeem. You have ${available}.`, { code: "BELOW_MINIMUM", available, min });
    if (reward.points > available) throw invalid(`This reward needs ${reward.points} points. You have ${available} available.`, { code: "INSUFFICIENT", available, needed: reward.points });

    const n = await tx.nextSequence("REDEMPTION");
    const number = `R-${String(n).padStart(4, "0")}`;
    const redemption = await tx.createRedemption({
      number,
      partnerId,
      rewardId,
      rewardName: reward.name,
      points: reward.points,
      pointValue: String(settings.values.pointValue),
      notes: String(notes ?? "").trim().slice(0, 500) || null,
      status: "REQUESTED",
      requestedAt: now,
    });
    const r = await drawFromLots(tx, lots, reward.points, "redeemedPoints");
    if (r.taken !== reward.points) throw conflict("Balance changed while processing. Please try again.");
    await recordDebit(tx, { partnerId, type: "REDEMPTION", parts: r.parts, taken: r.taken, note: `${number} · ${reward.name}`, refs: { redemptionId: redemption.id } });
    await audit(tx, { userId: partner.userId, action: "REDEMPTION_REQUEST", entityType: "Redemption", entityId: redemption.id, after: { number, reward: reward.name, points: reward.points } });
    await notifyPartner(tx, partner, "REDEMPTION_REQUESTED", { number, reward: reward.name, points: reward.points });
    await notifyStaff(tx, "STAFF_REDEMPTION", { number, partnerCode: partner.code, reward: reward.name, points: reward.points });
    return redemption;
  });
}

const FLOW = {
  approve: { from: ["REQUESTED"], to: "APPROVED", stamp: "approvedAt", notice: "REDEMPTION_APPROVED", action: "REDEMPTION_APPROVE" },
  ready: { from: ["APPROVED"], to: "READY", stamp: "readyAt", notice: "REDEMPTION_READY", action: "REDEMPTION_READY" },
  collect: { from: ["READY"], to: "COLLECTED", stamp: "collectedAt", notice: "REDEMPTION_COLLECTED", action: "REDEMPTION_COLLECT" },
};

export async function advanceRedemption(repo, { redemptionId, step, userId = null, ip = null, now = new Date() }) {
  const f = FLOW[step];
  if (!f) throw invalid("Unknown action");
  return repo.transaction(async (tx) => {
    const r = await tx.getRedemption(redemptionId);
    if (!r) throw notFound("Redemption");
    if (!f.from.includes(r.status)) throw conflict(`Cannot ${step} a redemption that is ${r.status.toLowerCase()}`);
    const updated = await tx.updateRedemption(redemptionId, { status: f.to, [f.stamp]: now, handledById: userId });
    const partner = await tx.getPartner(r.partnerId);
    await audit(tx, { userId, action: f.action, entityType: "Redemption", entityId: redemptionId, before: { status: r.status }, after: { status: f.to }, ip });
    await notifyPartner(tx, partner, f.notice, { number: r.number, reward: r.rewardName, points: r.points });
    return updated;
  });
}

export async function rejectRedemption(repo, { redemptionId, reason, userId = null, ip = null, now = new Date() }) {
  const why = String(reason ?? "").trim();
  if (why.length < 3) throw invalid("A rejection reason is required");
  return repo.transaction(async (tx) => {
    const r = await tx.getRedemption(redemptionId);
    if (!r) throw notFound("Redemption");
    if (!["REQUESTED", "APPROVED"].includes(r.status)) throw conflict(`Cannot reject a redemption that is ${r.status.toLowerCase()}`);
    await tx.lockPartner(r.partnerId);
    // Return the points to the exact lots they came from
    const debit = await tx.findRedemptionDebit(redemptionId);
    const allocations = debit ? await tx.findAllocationsForLedgerEntry(debit.id) : [];
    let refunded = 0;
    const refund = await tx.createLedgerEntry({ partnerId: r.partnerId, type: "REDEMPTION_REFUND", points: r.points, redemptionId, note: `${r.number} rejected: ${why}`, createdById: userId });
    for (const a of allocations) {
      const lot = await tx.getLot(a.lotId);
      await tx.updateLot(lot.id, { remaining: lot.remaining + a.points, redeemedPoints: Math.max(0, (lot.redeemedPoints || 0) - a.points) });
      await tx.createAllocation({ lotId: lot.id, ledgerEntryId: refund.id, points: -a.points });
      refunded += a.points;
    }
    if (refunded !== r.points) throw conflict("Could not match the redeemed points to refund them");
    const updated = await tx.updateRedemption(redemptionId, { status: "REJECTED", rejectedAt: now, rejectionReason: why.slice(0, 500), handledById: userId });
    const partner = await tx.getPartner(r.partnerId);
    await audit(tx, { userId, action: "REDEMPTION_REJECT", entityType: "Redemption", entityId: redemptionId, before: { status: r.status }, after: { status: "REJECTED", refunded }, reason: why, ip });
    await notifyPartner(tx, partner, "REDEMPTION_REJECTED", { number: r.number, reward: r.rewardName, points: r.points, reason: why });
    return updated;
  });
}
