// Formatting helpers shared by server pages.
import { todayIST, dateOnlyToDate } from "../loyalty/dates.js";
import { CATEGORIES, TRADE_LABEL, TIER_LABEL } from "../loyalty/constants.js";

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: d instanceof Date && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? "UTC" : "Asia/Kolkata" }) : "—";
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—"); // date-only columns
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";
export const fmtNum = (n) => Number(n ?? 0).toLocaleString("en-IN");
export const fmtMoney = (n) => `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const catName = (id) => CATEGORIES[id]?.name ?? (id ? `Category ${id}` : "—");
export const tradeName = (t) => TRADE_LABEL[t] ?? t;
export const tierName = (t) => TIER_LABEL[t] ?? t;

/** Start of today and of this month in India, as instants. */
export function istBoundaries(now = new Date()) {
  const today = todayIST(now);
  const IST = 330 * 60000;
  return {
    today,
    startOfToday: new Date(dateOnlyToDate(today).getTime() - IST),
    startOfMonth: new Date(dateOnlyToDate(`${today.slice(0, 7)}-01`).getTime() - IST),
  };
}

export const q = (v) => (Array.isArray(v) ? v[0] : v) ?? "";
