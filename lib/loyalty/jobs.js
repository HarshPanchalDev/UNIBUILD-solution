// Daily jobs (run once a day, e.g. 00:30 IST): expiry, unlock notices, link reminders and
// link expiry, and the quarterly tier recalculation. Safe to run more than once a day.
import { todayIST, addDays, quarterOf, previousQuarter, toDateOnly } from "./dates.js";
import { TIER_LABEL, TRADES } from "./constants.js";
import { audit, notifyPartner, notifyStaff } from "./notify.js";
import { drawFromLots, recordDebit } from "./ledger.js";
import { parseScaled, VALUE_SCALE } from "./money.js";

export async function expirePoints(repo, now) {
  const lots = await repo.findExpiredLotsWithRemaining(now);
  const byPartner = new Map();
  for (const lot of lots) {
    await repo.transaction(async (tx) => {
      await tx.lockPartner(lot.partnerId);
      const fresh = await tx.getLot(lot.id);
      if (!fresh || fresh.remaining <= 0) return;
      const r = await drawFromLots(tx, [fresh], fresh.remaining, "expiredPoints");
      await recordDebit(tx, { partnerId: lot.partnerId, type: "EXPIRY", parts: r.parts, taken: r.taken, note: "Not redeemed within the validity period", refs: { lotId: lot.id } });
      byPartner.set(lot.partnerId, (byPartner.get(lot.partnerId) || 0) + r.taken);
    });
  }
  for (const [partnerId, points] of byPartner) {
    const p = await repo.getPartner(partnerId);
    await notifyPartner(repo, p, "POINTS_EXPIRED", { points });
  }
  return { lotsExpired: lots.length, partners: byPartner.size };
}

export async function notifyUnlocked(repo, now) {
  const lots = await repo.findUnlockedNotNotified(now);
  const byPartner = new Map();
  for (const lot of lots) byPartner.set(lot.partnerId, (byPartner.get(lot.partnerId) || 0) + lot.remaining);
  for (const [partnerId, points] of byPartner) {
    const p = await repo.getPartner(partnerId);
    if (points > 0) await notifyPartner(repo, p, "POINTS_UNLOCKED", { points });
  }
  for (const lot of lots) await repo.updateLot(lot.id, { unlockNotifiedAt: now });
  return { partners: byPartner.size };
}

/** LNK-03: reminder N days before expiry (to Store Manager and partner); expired links release their slot. */
export async function processLinks(repo, now, settings) {
  const today = todayIST(now);
  const days = settings.values.linkReminderDays;
  const due = await repo.findLinksDueReminder(addDays(today, days));
  for (const link of due) {
    const site = await repo.getSite(link.siteId);
    const partner = await repo.getPartner(link.partnerId);
    const endDate = toDateOnly(link.endDate);
    await notifyStaff(repo, "STAFF_LINK_EXPIRING", { days, siteCode: site.code, partnerCode: partner.code, trade: link.trade, endDate, linkId: link.id });
    await notifyPartner(repo, partner, "LINK_EXPIRING", { siteCode: site.code, endDate });
    await repo.updateLink(link.id, { reminderSentAt: now });
  }
  const expiring = await repo.findLinksToExpire(today);
  for (const link of expiring) {
    await repo.updateLink(link.id, { status: link.endedOn ? "ENDED" : "EXPIRED", activeSlot: null });
    await audit(repo, { action: "LINK_EXPIRE", entityType: "SiteLink", entityId: link.id, after: { status: "EXPIRED", endDate: toDateOnly(link.endDate) } });
  }
  return { reminders: due.length, expired: expiring.length };
}

/**
 * Tiers (spec 7.6): paid purchase value on linked sites in the previous quarter, per trade.
 * Trades whose thresholds are not set yet (open question Q7) are skipped.
 */
export async function recalculateTiers(repo, { now = new Date(), settings, userId = null }) {
  const prev = previousQuarter(todayIST(now));
  const totals = await repo.sumCreditedTaxableByPartner(prev.start, prev.end);
  const partners = await repo.listApprovedPartners();
  const result = { quarter: prev.label, changed: 0, skippedTrades: [] };
  for (const trade of TRADES) {
    const t = settings.values.tierThresholds[trade];
    if (t.SILVER === null || t.GOLD === null) result.skippedTrades.push(trade);
  }
  for (const p of partners) {
    const t = settings.values.tierThresholds[p.trade];
    if (t.SILVER === null || t.GOLD === null) continue;
    const value = Number(parseScaled(totals.get(p.id) ?? "0", VALUE_SCALE)) / 100;
    const tier = value >= t.GOLD ? "GOLD" : value >= t.SILVER ? "SILVER" : "SAATHI";
    if (tier === p.tier) continue;
    await repo.transaction(async (tx) => {
      await tx.updatePartner(p.id, { tier });
      await tx.createTierHistory({ partnerId: p.id, fromTier: p.tier, toTier: tier, quarter: prev.label, purchaseValue: (totals.get(p.id) ?? "0"), reason: "Quarterly recalculation", createdById: userId });
      await audit(tx, { userId, action: "TIER_RECALC", entityType: "Partner", entityId: p.id, before: { tier: p.tier }, after: { tier, quarter: prev.label, value } });
      await notifyPartner(tx, p, "TIER_CHANGED", { tier, tierLabel: TIER_LABEL[tier], multiplier: settings.values.multipliers[tier] });
    });
    result.changed++;
  }
  return result;
}

export async function runDailyJobs(repo, { now = new Date(), settings }) {
  const out = {};
  out.expiry = await expirePoints(repo, now);
  out.unlocked = await notifyUnlocked(repo, now);
  out.links = await processLinks(repo, now, settings);
  const q = quarterOf(todayIST(now));
  if (await repo.markJobRun(`TIERS-${q.label}`)) {
    out.tiers = await recalculateTiers(repo, { now, settings });
  }
  return out;
}
