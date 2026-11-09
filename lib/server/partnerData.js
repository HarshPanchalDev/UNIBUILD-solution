import "server-only";
import { prisma, repo } from "./db.js";
import { getActiveSettings } from "../loyalty/settingsService.js";
import { getPartnerSummary, getPartnerHistory, getPartnerSites } from "../loyalty/partnerViews.js";
import { noticeText } from "../loyalty/notify.js";

// Partner pages read ONLY through these helpers, which return privacy-safe shapes (T-16).

export async function loadSummary(partnerId) {
  const settings = await getActiveSettings(repo);
  return getPartnerSummary(repo, partnerId, { settings });
}

export const loadHistory = (partnerId) => getPartnerHistory(repo, partnerId);
export const loadSites = (partnerId) => getPartnerSites(repo, partnerId);

export async function loadNotices(userId, lang, take = 50) {
  const rows = await prisma.notification.findMany({ where: { audience: "PARTNER", userId }, orderBy: { id: "desc" }, take });
  return rows.map((n) => {
    const text = noticeText(n.type, n.data ?? {}, lang) ?? { title: n.title, body: n.body };
    return { id: n.id, type: n.type, title: text.title, body: text.body, read: Boolean(n.readAt), createdAt: n.createdAt.toISOString() };
  });
}

export async function loadRewards() {
  const rows = await prisma.reward.findMany({ where: { status: "ACTIVE" }, orderBy: [{ sortOrder: "asc" }, { points: "asc" }] });
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, section: r.section, points: r.points, imageKey: r.imageKey }));
}

export async function loadRedemptions(partnerId) {
  const rows = await prisma.redemption.findMany({ where: { partnerId }, orderBy: { id: "desc" }, take: 100 });
  return rows.map((r) => ({ id: r.id, number: r.number, reward: r.rewardName, points: r.points, status: r.status, reason: r.rejectionReason, requestedAt: r.requestedAt.toISOString(), notes: r.notes }));
}

export async function loadLinkRequests(partnerId) {
  const rows = await prisma.siteLinkRequest.findMany({ where: { partnerId }, orderBy: { id: "desc" }, take: 20 });
  // owner name/phone stay visible here only because the partner typed them in
  return rows.map((r) => ({ id: r.id, type: r.type, siteCode: r.siteCode, colony: r.colony, ownerName: r.ownerName, status: r.status, note: r.status === "REJECTED" ? r.reviewNote : null, createdAt: r.createdAt.toISOString() }));
}
