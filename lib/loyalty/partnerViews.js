// Data for the partner app. These shapes are the ONLY partner-facing data:
// no invoice amounts, prices, owner names/phones (except sites the partner submitted) or other partners (T-16).
import { lotState, summarizeLots } from "./balance.js";
import { CATEGORY_TRADE, TIERS } from "./constants.js";
import { toDateOnly, todayIST, previousQuarter, quarterOf } from "./dates.js";
import { linkCoversDate } from "./links.js";
import { parseScaled, VALUE_SCALE } from "./money.js";

export function publicSite(site, partnerId) {
  return {
    code: site.code,
    name: site.displayName || site.colony,
    colony: site.colony,
    mapsUrl: site.mapsUrl ?? null,
    // owner details only for a site this partner submitted
    ownerName: site.submittedByPartnerId === partnerId ? site.ownerName : undefined,
  };
}

export async function getPartnerSummary(repo, partnerId, { now = new Date(), settings }) {
  const partner = await repo.getPartner(partnerId);
  const lots = await repo.findPartnerLots(partnerId, { withRemaining: true });
  const balance = summarizeLots(lots, now);
  const tierIdx = TIERS.indexOf(partner.tier);
  const nextTier = TIERS[tierIdx + 1] ?? null;
  let progress = null;
  if (nextTier) {
    const threshold = settings.values.tierThresholds[partner.trade]?.[nextTier];
    if (threshold) {
      const q = quarterOf(todayIST(now));
      const totals = await repo.sumCreditedTaxableByPartner(q.start, q.end);
      const value = Number(parseScaled(totals.get(partnerId) ?? "0", VALUE_SCALE)) / 100;
      progress = Math.max(0, Math.min(100, Math.round((value / threshold) * 100)));
    }
  }
  return {
    name: partner.name,
    code: partner.code,
    trade: partner.trade,
    status: partner.status,
    tier: partner.tier,
    nextTier,
    tierProgress: progress, // null = thresholds not set yet
    multiplier: settings.values.multipliers[partner.tier],
    available: balance.available,
    locked: balance.locked,
    total: balance.total,
    nextUnlock: balance.nextUnlock ? { date: balance.nextUnlock.at.toISOString(), points: balance.nextUnlock.points } : null,
    expiringSoon: balance.expiringSoon,
    minRedeem: settings.values.minRedeem,
  };
}

const LEDGER_STATE = { REVERSAL: "REVERSED", REDEMPTION: "REDEEMED", REDEMPTION_REFUND: "AVAILABLE", EXPIRY: "EXPIRED" };

/** Points history rows: one per ledger entry. */
export async function getPartnerHistory(repo, partnerId, { now = new Date() } = {}) {
  const entries = await repo.findPartnerLedger(partnerId);
  const lots = new Map((await repo.findPartnerLots(partnerId)).map((l) => [l.id, l]));
  const siteIds = [...new Set(entries.map((e) => e.siteId).filter(Boolean))];
  const sites = new Map();
  for (const id of siteIds) {
    const s = await repo.getSite(id);
    if (s) sites.set(id, publicSite(s, partnerId));
  }
  return entries.map((e) => {
    let state;
    if (e.type === "CREDIT" || (e.type === "ADJUSTMENT" && e.points > 0)) {
      const lot = e.lotId ? lots.get(e.lotId) : null;
      state = lot ? lotState(lot, now) : "AVAILABLE";
    } else if (e.type === "ADJUSTMENT") state = "ADJUSTED";
    else state = LEDGER_STATE[e.type] ?? "AVAILABLE";
    const lot = e.lotId ? lots.get(e.lotId) : null;
    return {
      id: e.id,
      date: new Date(e.createdAt).toISOString(),
      type: e.type,
      points: e.points,
      state,
      unlockAt: state === "LOCKED" && lot ? new Date(lot.unlockAt).toISOString() : null,
      category: e.category ?? null,
      site: e.siteId ? sites.get(e.siteId) ?? null : null,
      note: e.type === "ADJUSTMENT" || e.type === "REDEMPTION" || e.type === "REDEMPTION_REFUND" ? e.note : null,
    };
  });
}

/** My Sites: links of this partner (active first), with link dates. */
export async function getPartnerSites(repo, partnerId, { now = new Date() } = {}) {
  const today = todayIST(now);
  const links = await repo.findPartnerLinks(partnerId);
  const out = [];
  for (const l of links) {
    const site = await repo.getSite(l.siteId);
    if (!site) continue;
    const active = Boolean(l.activeSlot) && linkCoversDate(l, today);
    out.push({
      linkId: l.id,
      site: publicSite(site, partnerId),
      siteStatus: site.status === "MERGED" ? "ACTIVE" : site.status,
      trade: l.trade,
      categories: Object.entries(CATEGORY_TRADE).filter(([, t]) => t === l.trade).map(([id]) => Number(id)),
      startDate: toDateOnly(l.startDate),
      endDate: toDateOnly(l.endedOn ?? l.endDate),
      active,
    });
  }
  return out.sort((a, b) => Number(b.active) - Number(a.active) || b.startDate.localeCompare(a.startDate));
}

export { previousQuarter };
