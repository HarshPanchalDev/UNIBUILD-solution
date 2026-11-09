// Notifications. Each notice stores a `type` + `data` so the partner app can show it in Hindi or English.
// `title`/`body` hold the English text (used by staff screens and as a fallback).
import { categoryName } from "./constants.js";
import { formatDisplayDate } from "./dates.js";

const fmt = (n) => Number(n).toLocaleString("en-IN");

const TEMPLATES = {
  POINTS_CREDITED: {
    en: (d) => [`${fmt(d.points)} points credited`, `Site ${d.siteCode} · ${categoryName(d.category)}. Redeemable from ${formatDisplayDate(d.unlockAt, "en")}.`],
    hi: (d) => [`${fmt(d.points)} पॉइंट्स जमा हुए`, `साइट ${d.siteCode} · ${categoryName(d.category, "hi")}। ${formatDisplayDate(d.unlockAt, "hi")} से रिडीम कर सकते हैं।`],
  },
  POINTS_UNLOCKED: {
    en: (d) => [`${fmt(d.points)} points are now available`, `Your locked points have become redeemable.`],
    hi: (d) => [`${fmt(d.points)} पॉइंट्स अब उपलब्ध हैं`, `आपके लॉक पॉइंट्स अब रिडीम किए जा सकते हैं।`],
  },
  POINTS_REVERSED: {
    en: (d) => [`Return recorded on site ${d.siteCode}`, `${d.returned} ${categoryName(d.category)}. ${fmt(d.points)} points deducted.`],
    hi: (d) => [`साइट ${d.siteCode} पर रिटर्न दर्ज हुआ`, `${d.returned} ${categoryName(d.category, "hi")}। ${fmt(d.points)} पॉइंट्स काटे गए।`],
  },
  POINTS_EXPIRED: {
    en: (d) => [`${fmt(d.points)} points expired`, `These points were not redeemed within the validity period.`],
    hi: (d) => [`${fmt(d.points)} पॉइंट्स की अवधि समाप्त`, `ये पॉइंट्स तय समय में रिडीम नहीं हुए।`],
  },
  POINTS_ADJUSTED: {
    en: (d) => [`Points adjusted by ${d.points > 0 ? "+" : ""}${fmt(d.points)}`, `Reason: ${d.reason}`],
    hi: (d) => [`पॉइंट्स में बदलाव: ${d.points > 0 ? "+" : ""}${fmt(d.points)}`, `कारण: ${d.reason}`],
  },
  TIER_CHANGED: {
    en: (d) => [`You are now ${d.tierLabel}`, `You earn ${d.multiplier}× points on paid purchases.`],
    hi: (d) => [`अब आप ${d.tierLabel} हैं`, `आपको पेड खरीद पर ${d.multiplier}× पॉइंट्स मिलेंगे।`],
  },
  PARTNER_APPROVED: {
    en: (d) => [`Welcome! Your Partner Code is ${d.code}`, `Your registration is approved. You can now earn points on linked sites.`],
    hi: (d) => [`स्वागत है! आपका पार्टनर कोड ${d.code} है`, `आपका रजिस्ट्रेशन स्वीकृत हो गया। अब आप लिंक साइट्स पर पॉइंट्स कमा सकते हैं।`],
  },
  PARTNER_REJECTED: {
    en: (d) => [`Registration not approved`, `Reason: ${d.reason}`],
    hi: (d) => [`रजिस्ट्रेशन स्वीकृत नहीं हुआ`, `कारण: ${d.reason}`],
  },
  PARTNER_SUSPENDED: {
    en: (d) => [`Account suspended`, `Reason: ${d.reason}. Contact the UNIBUILD store.`],
    hi: (d) => [`खाता निलंबित`, `कारण: ${d.reason}। UNIBUILD स्टोर से संपर्क करें।`],
  },
  PARTNER_REINSTATED: {
    en: () => [`Account reinstated`, `You can earn and redeem points again.`],
    hi: () => [`खाता फिर से चालू`, `आप फिर से पॉइंट्स कमा और रिडीम कर सकते हैं।`],
  },
  LINK_CREATED: {
    en: (d) => [`Linked to site ${d.siteCode}`, `You will earn points on ${d.categories} for this site until ${formatDisplayDate(d.endDate, "en")}.`],
    hi: (d) => [`साइट ${d.siteCode} से लिंक हुए`, `${formatDisplayDate(d.endDate, "hi")} तक इस साइट की खरीद पर पॉइंट्स मिलेंगे।`],
  },
  LINK_ENDED: {
    en: (d) => [`Link to site ${d.siteCode} ended`, d.reason ? `Reason: ${d.reason}` : `New purchases on this site will not earn you points.`],
    hi: (d) => [`साइट ${d.siteCode} का लिंक समाप्त`, `इस साइट की नई खरीद पर आपको पॉइंट्स नहीं मिलेंगे।`],
  },
  LINK_EXPIRING: {
    en: (d) => [`Link to site ${d.siteCode} ends soon`, `Your link ends on ${formatDisplayDate(d.endDate, "en")}. Ask the store to renew it.`],
    hi: (d) => [`साइट ${d.siteCode} का लिंक जल्द खत्म होगा`, `लिंक ${formatDisplayDate(d.endDate, "hi")} को खत्म होगा। रिन्यू के लिए स्टोर से बात करें।`],
  },
  LINK_REQUEST_REJECTED: {
    en: (d) => [`Site link request not approved`, `Reason: ${d.reason}`],
    hi: (d) => [`साइट लिंक अनुरोध स्वीकृत नहीं हुआ`, `कारण: ${d.reason}`],
  },
  REDEMPTION_REQUESTED: {
    en: (d) => [`Redemption ${d.number} requested`, `${d.reward} · ${fmt(d.points)} points`],
    hi: (d) => [`रिडेम्पशन ${d.number} का अनुरोध भेजा गया`, `${d.reward} · ${fmt(d.points)} पॉइंट्स`],
  },
  REDEMPTION_APPROVED: {
    en: (d) => [`Redemption ${d.number} approved`, `${d.reward}. We will tell you when it is ready for pickup.`],
    hi: (d) => [`रिडेम्पशन ${d.number} स्वीकृत`, `${d.reward}। तैयार होने पर हम बताएंगे।`],
  },
  REDEMPTION_REJECTED: {
    en: (d) => [`Redemption ${d.number} rejected`, `Reason: ${d.reason}. ${fmt(d.points)} points returned to your balance.`],
    hi: (d) => [`रिडेम्पशन ${d.number} अस्वीकृत`, `कारण: ${d.reason}। ${fmt(d.points)} पॉइंट्स वापस जोड़ दिए गए।`],
  },
  REDEMPTION_READY: {
    en: (d) => [`${d.reward} is ready for pickup`, `Collect it at the UNIBUILD counter. Ref ${d.number}.`],
    hi: (d) => [`${d.reward} पिकअप के लिए तैयार है`, `UNIBUILD काउंटर से ले लें। संदर्भ ${d.number}।`],
  },
  REDEMPTION_COLLECTED: {
    en: (d) => [`Redemption ${d.number} collected`, `${d.reward} handed over. Thank you!`],
    hi: (d) => [`रिडेम्पशन ${d.number} प्राप्त हुआ`, `${d.reward} आपको दे दिया गया। धन्यवाद!`],
  },
  // staff
  STAFF_LINK_REQUEST: { en: (d) => [`New site link request`, `${d.partnerCode} · ${d.summary}`] },
  STAFF_REDEMPTION: { en: (d) => [`New redemption request ${d.number}`, `${d.partnerCode} · ${d.reward} · ${fmt(d.points)} pts`] },
  STAFF_PARTNER_SIGNUP: { en: (d) => [`New partner registration`, `${d.name} · ${d.trade}`] },
  STAFF_LINK_EXPIRING: { en: (d) => [`Link ending in ${d.days} days`, `${d.siteCode} · ${d.partnerCode} (${d.trade}) ends ${formatDisplayDate(d.endDate, "en")}`] },
  STAFF_SHORTFALL: { en: (d) => [`Return shortfall needs a decision`, `${d.partnerCode}: ${fmt(d.points)} points could not be reversed (policy ${d.policy}).`] },
};

export function noticeText(type, data = {}, lang = "en") {
  const t = TEMPLATES[type];
  if (!t) return null;
  const fn = t[lang] ?? t.en;
  const [title, body] = fn(data);
  return { title, body };
}

export async function notifyPartner(repo, partner, type, data) {
  const { title, body } = noticeText(type, data, "en");
  return repo.createNotification({ audience: "PARTNER", userId: partner.userId, type, title, body, data });
}

export async function notifyStaff(repo, type, data, userId = null) {
  const { title, body } = noticeText(type, data, "en");
  return repo.createNotification({ audience: "STAFF", userId, type, title, body, data });
}

export async function audit(repo, { userId = null, action, entityType, entityId = null, before = null, after = null, reason = null, ip = null }) {
  return repo.createAudit({ userId, action, entityType, entityId: entityId === null ? null : String(entityId), before, after, reason, ip });
}
