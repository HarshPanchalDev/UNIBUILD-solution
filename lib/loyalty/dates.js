// Date helpers. Business dates (invoice date, link dates) are date-only strings "YYYY-MM-DD"
// interpreted in India time. Timestamps (creditedAt, unlockAt) are real instants.

const IST_OFFSET_MS = 330 * 60 * 1000;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n) => String(n).padStart(2, "0");

function isValidYmd(y, m, d) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

function ymd(y, m, d) {
  return isValidYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/**
 * Parse a date from a BUSY export cell. Accepts JS Date (from Excel), Excel serial numbers,
 * ISO "2026-11-14", Indian "14-11-2026" / "14/11/2026" / "14.11.2026", and "14-Nov-2026".
 * Day-first is assumed for ambiguous numeric dates (Indian format).
 */
export function parseBusyDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null; // Excel serial range ~1954-2119
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return ymd(y, +m[2], +m[1]);
  }
  m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/,]+(\d{2,4})$/);
  if (m) {
    const name = m[2].toLowerCase();
    const mon = MONTHS[name] ?? MONTHS[name.slice(0, 3)];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return mon ? ymd(y, mon, +m[1]) : null;
  }
  if (/^\d+(\.\d+)?$/.test(s)) return parseBusyDate(Number(s));
  return null;
}

/** "YYYY-MM-DD" -> Date at UTC midnight (how date-only columns are stored). */
export function dateOnlyToDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date (UTC midnight) or "YYYY-MM-DD" -> "YYYY-MM-DD" */
export function toDateOnly(value) {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

/** Today's business date in India for an instant. */
export function todayIST(now = new Date()) {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date, days) {
  if (typeof date === "string") {
    const d = dateOnlyToDate(date);
    d.setUTCDate(d.getUTCDate() + days);
    return toDateOnly(d);
  }
  return new Date(date.getTime() + days * 86400000);
}

/** Add calendar months; clamps the day (31 Jan + 1 month = 28/29 Feb). Works for strings and Dates. */
export function addMonths(date, months) {
  const isStr = typeof date === "string";
  const d = isStr ? dateOnlyToDate(date) : new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, dim));
  return isStr ? toDateOnly(d) : d;
}

/** Quarter helpers for tier recalculation. */
export function quarterOf(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  const startMonth = (q - 1) * 3 + 1;
  const start = `${y}-${pad(startMonth)}-01`;
  return { label: `${y}-Q${q}`, start, end: addMonths(start, 3) };
}

export function previousQuarter(dateStr) {
  const { start } = quarterOf(dateStr);
  return quarterOf(addMonths(start, -3));
}

export function formatDisplayDate(value, lang = "en") {
  if (!value) return "";
  const d = typeof value === "string" ? (value.length === 10 ? dateOnlyToDate(value) : new Date(value)) : value;
  const opts = typeof value === "string" && value.length === 10
    ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }
    : { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" };
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", opts);
}

export function formatDisplayDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
}
