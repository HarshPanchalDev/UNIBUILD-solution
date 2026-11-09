// Partner–site links (spec 6.2, LNK-01..07).
import { conflict, invalid, notFound } from "./errors.js";
import { audit, notifyPartner } from "./notify.js";
import { addMonths, todayIST, toDateOnly } from "./dates.js";
import { CATEGORY_TRADE, categoryName } from "./constants.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const slotKey = (siteId, trade) => `${siteId}:${trade}`;

export function categoriesForTrade(trade) {
  return Object.entries(CATEGORY_TRADE)
    .filter(([, t]) => t === trade)
    .map(([id]) => categoryName(Number(id)))
    .join(", ");
}

/** A link is effective on date D when start <= D < min(endDate, endedOn). */
export function linkCoversDate(link, dateStr) {
  const start = toDateOnly(link.startDate);
  const end = toDateOnly(link.endDate);
  const ended = link.endedOn ? toDateOnly(link.endedOn) : null;
  return start <= dateStr && dateStr < end && (!ended || dateStr < ended);
}

function requireReason(reason) {
  const r = String(reason ?? "").trim();
  if (r.length < 3) throw invalid("A reason is required for every link change (LNK-07)");
  return r.slice(0, 500);
}

/** Clear the active slot of a link that has already run out, so a new link can take it. */
async function releaseStaleSlot(tx, siteId, trade, today) {
  const current = await tx.findActiveLink(siteId, trade);
  if (!current) return null;
  const end = toDateOnly(current.endDate);
  const ended = current.endedOn ? toDateOnly(current.endedOn) : null;
  if (end <= today || (ended && ended <= today)) {
    await tx.updateLink(current.id, { status: end <= today ? "EXPIRED" : "ENDED", activeSlot: null });
    return null;
  }
  return current;
}

export async function createLink(repo, { siteId, partnerId, startDate, reason, userId = null, ip = null, now = new Date(), settings }) {
  const why = requireReason(reason);
  const today = todayIST(now);
  const start = startDate || today;
  if (!DATE_RE.test(start)) throw invalid("Start date must be YYYY-MM-DD");
  return repo.transaction(async (tx) => {
    const site = await tx.getSite(siteId);
    if (!site || site.status === "MERGED") throw notFound("Site");
    await tx.lockPartner(partnerId);
    const partner = await tx.getPartner(partnerId);
    if (!partner) throw notFound("Partner");
    if (partner.status !== "APPROVED") throw invalid("Only approved partners can be linked to a site");
    const trade = partner.trade;
    const current = await releaseStaleSlot(tx, siteId, trade, today);
    if (current) {
      const holder = await tx.getPartner(current.partnerId);
      throw conflict(`Site ${site.code} already has an active ${trade.toLowerCase()} link (${holder?.code ?? "another partner"}). Use "Change partner" instead.`, { linkId: current.id });
    }
    const endDate = addMonths(start, settings.values.linkMonths);
    const link = await tx.createLink({
      siteId,
      partnerId,
      trade,
      startDate: start,
      endDate,
      status: "ACTIVE",
      activeSlot: slotKey(siteId, trade),
      reason: why,
      createdById: userId,
    });
    await audit(tx, { userId, action: "LINK_CREATE", entityType: "SiteLink", entityId: link.id, after: { site: site.code, partner: partner.code, trade, startDate: start, endDate }, reason: why, ip });
    await notifyPartner(tx, partner, "LINK_CREATED", { siteCode: site.code, categories: categoriesForTrade(trade), endDate });
    return link;
  });
}

export async function endLink(repo, { linkId, endDate, reason, userId = null, ip = null, now = new Date(), notify = true }) {
  const why = requireReason(reason);
  const date = endDate || todayIST(now);
  if (!DATE_RE.test(date)) throw invalid("End date must be YYYY-MM-DD");
  return repo.transaction(async (tx) => {
    const link = await tx.getLink(linkId);
    if (!link) throw notFound("Link");
    if (link.status !== "ACTIVE" || !link.activeSlot) throw invalid("This link is not active");
    if (date < toDateOnly(link.startDate)) throw invalid("End date cannot be before the link start date");
    const updated = await tx.updateLink(linkId, { status: "ENDED", endedOn: date, activeSlot: null, endReason: why, endedById: userId });
    const site = await tx.getSite(link.siteId);
    const partner = await tx.getPartner(link.partnerId);
    await audit(tx, { userId, action: "LINK_END", entityType: "SiteLink", entityId: linkId, before: { status: "ACTIVE", endedOn: null }, after: { status: "ENDED", endedOn: date, site: site.code, partner: partner.code }, reason: why, ip });
    if (notify) await notifyPartner(tx, partner, "LINK_ENDED", { siteCode: site.code, reason: why });
    return updated;
  });
}

/**
 * LNK-05: the old link ends and the new one starts on the same day. Points already credited stay
 * with the old partner; invoices dated from that day go to the new partner.
 */
export async function changeLinkPartner(repo, { linkId, newPartnerId, date, reason, userId = null, ip = null, now = new Date(), settings }) {
  const why = requireReason(reason);
  const day = date || todayIST(now);
  return repo.transaction(async (tx) => {
    const link = await tx.getLink(linkId);
    if (!link || link.status !== "ACTIVE" || !link.activeSlot) throw invalid("This link is not active");
    if (link.partnerId === newPartnerId) throw invalid("Choose a different partner");
    const newPartner = await tx.getPartner(newPartnerId);
    if (!newPartner || newPartner.status !== "APPROVED") throw invalid("The new partner must be approved");
    if (newPartner.trade !== link.trade) throw invalid(`The new partner must be a ${link.trade.toLowerCase()}`);
    await endLink(tx, { linkId, endDate: day, reason: `Partner changed: ${why}`, userId, ip, now });
    return createLink(tx, { siteId: link.siteId, partnerId: newPartnerId, startDate: day, reason: `Replaces link #${linkId}: ${why}`, userId, ip, now, settings });
  });
}

/** LNK-03: renew for another period from the current end date. */
export async function renewLink(repo, { linkId, reason, userId = null, ip = null, settings }) {
  const why = requireReason(reason);
  return repo.transaction(async (tx) => {
    const link = await tx.getLink(linkId);
    if (!link || link.status !== "ACTIVE" || !link.activeSlot) throw invalid("Only an active link can be renewed");
    const oldEnd = toDateOnly(link.endDate);
    const newEnd = addMonths(oldEnd, settings.values.linkMonths);
    const updated = await tx.updateLink(linkId, { endDate: newEnd, reminderSentAt: null });
    await audit(tx, { userId, action: "LINK_RENEW", entityType: "SiteLink", entityId: linkId, before: { endDate: oldEnd }, after: { endDate: newEnd }, reason: why, ip });
    return updated;
  });
}

/** The link that decides who earns for (site, trade) on an invoice date (LNK-04). */
export async function findCoveringLink(repo, siteId, trade, invoiceDate) {
  return repo.findLinkCovering(siteId, trade, invoiceDate);
}
