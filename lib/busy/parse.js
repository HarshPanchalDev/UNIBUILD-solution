// BUSY file parser: turns a 2-D table (from CSV or XLSX) into normalized lines.
// It knows nothing about points; the loyalty engine decides what each line earns.
// Keeping this separate lets a future BUSY API feed the same engine (spec section 8).
import { INVOICE_COLUMNS, CREDIT_NOTE_COLUMNS, SITE_IMPORT_COLUMNS, mapHeaders } from "./columns.js";
import { parseBusyDate } from "../loyalty/dates.js";
import { parseScaled, formatScaled, VALUE_SCALE, QTY_SCALE } from "../loyalty/money.js";
import { WALK_IN } from "../loyalty/constants.js";

const CATEGORY_NAMES = {
  cement: 1,
  waterproofing: 2,
  hardware: 2,
  "waterproofing and hardware": 2,
  "waterproofing & hardware": 2,
  plumbing: 3,
  electrical: 4,
  paint: 5,
};

/** "1", 1, "1.0", "Cement" -> 1. Returns null if missing, NaN-like string if invalid. */
export function parseCategory(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return { value: null, missing: true };
  const s = String(raw).trim();
  if (/^\d+(\.0+)?$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 5 ? { value: n } : { value: null, invalid: true };
  }
  const byName = CATEGORY_NAMES[s.toLowerCase()];
  return byName ? { value: byName } : { value: null, invalid: true };
}

export function normalizeSiteCode(raw) {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (s === "WALKIN" || s === "WALK-IN" || s === "WALK_IN") return WALK_IN;
  return s;
}

const cellText = (v) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v).trim());

function findHeaderRow(rows, columns) {
  // The header is the first row (within the first 10) that maps the most required columns.
  let best = { index: -1, missing: columns.map((c) => c.label), mapping: {} };
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const res = mapHeaders(rows[i].map(cellText), columns);
    if (res.missing.length < best.missing.length) best = { index: i, ...res };
    if (res.missing.length === 0) break;
  }
  return best;
}

function parseLines(rows, columns, kind) {
  if (!rows.length) return { ok: false, missing: columns.filter((c) => !c.optional).map((c) => c.label), error: "The file is empty" };
  const header = findHeaderRow(rows, columns);
  if (header.missing.length) {
    return { ok: false, missing: header.missing, error: `Missing required column(s): ${header.missing.join(", ")}` };
  }
  const m = header.mapping;
  const get = (row, key) => (m[key] === undefined ? undefined : row[m[key]]);
  const lines = [];
  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => cellText(c) === "")) continue;
    const rowNumber = i + 1; // 1-based like Excel
    const qty = parseScaled(get(row, "quantity"), QTY_SCALE);
    const val = parseScaled(get(row, "taxableValue"), VALUE_SCALE);
    const cat = parseCategory(get(row, "category"));
    const issues = [];
    const line = {
      rowNumber,
      siteCode: normalizeSiteCode(get(row, "siteCode")),
      itemName: cellText(get(row, "itemName")).slice(0, 255) || "(no item name)",
      categoryRaw: cellText(get(row, "category")).slice(0, 60),
      category: cat.value,
      quantity: qty === null ? null : formatScaled(qty < 0n ? -qty : qty, QTY_SCALE),
      unit: cellText(get(row, "unit")).slice(0, 20),
      taxableValue: val === null ? null : formatScaled(val < 0n ? -val : val, VALUE_SCALE),
    };
    if (kind === "INVOICE") {
      line.documentNumber = cellText(get(row, "invoiceNumber"));
      line.invoiceDate = parseBusyDate(get(row, "invoiceDate"));
      line.paymentDate = parseBusyDate(get(row, "paymentDate"));
      if (!line.invoiceDate) issues.push("INVALID_DATE");
      if (!line.paymentDate) issues.push("INVALID_DATE");
      if (qty !== null && qty < 0n) issues.push("INVALID_VALUE");
      if (val !== null && val < 0n) issues.push("INVALID_VALUE");
    } else {
      line.documentNumber = cellText(get(row, "creditNoteNumber"));
      line.noteDate = parseBusyDate(get(row, "creditNoteDate"));
      line.originalInvoiceNumber = cellText(get(row, "originalInvoiceNumber"));
      if (!line.noteDate) issues.push("INVALID_DATE");
    }
    if (qty === null || val === null) issues.push("INVALID_VALUE");
    if (cat.missing) issues.push("MISSING_CATEGORY");
    else if (cat.invalid) issues.push("INVALID_CATEGORY");
    if (!line.siteCode) issues.push("MISSING_SITE_CODE");
    line.issues = [...new Set(issues)];
    line.raw = Object.fromEntries(columns.map((c) => [c.label, cellText(get(row, c.key))]));
    lines.push(line);
  }
  return { ok: true, lines, headerRow: header.index + 1 };
}

/** Paid-invoice export (spec 8.1). rows: array of arrays (cells). */
export function parseInvoiceRows(rows) {
  const res = parseLines(rows, INVOICE_COLUMNS, "INVOICE");
  if (!res.ok) return res;
  const blank = res.lines.filter((l) => !l.documentNumber);
  if (blank.length) {
    return { ok: false, missing: [], error: `Invoice number is empty on row(s) ${blank.slice(0, 10).map((l) => l.rowNumber).join(", ")}` };
  }
  return res;
}

/** Credit-note export (spec 8.2). */
export function parseCreditNoteRows(rows) {
  const res = parseLines(rows, CREDIT_NOTE_COLUMNS, "CREDIT_NOTE");
  if (!res.ok) return res;
  const blank = res.lines.filter((l) => !l.documentNumber || !l.originalInvoiceNumber);
  if (blank.length) {
    return { ok: false, missing: [], error: `Credit note number or original invoice number is empty on row(s) ${blank.slice(0, 10).map((l) => l.rowNumber).join(", ")}` };
  }
  return res;
}

/** Field-survey site import. */
export function parseSiteImportRows(rows) {
  if (!rows.length) return { ok: false, missing: [], error: "The file is empty" };
  const header = findHeaderRow(rows, SITE_IMPORT_COLUMNS);
  if (header.missing.length) return { ok: false, missing: header.missing, error: `Missing required column(s): ${header.missing.join(", ")}` };
  const m = header.mapping;
  const get = (row, key) => (m[key] === undefined ? "" : cellText(row[m[key]]));
  const sites = [];
  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => cellText(c) === "")) continue;
    sites.push({
      rowNumber: i + 1,
      code: normalizeSiteCode(get(row, "siteCode")),
      ownerName: get(row, "ownerName"),
      phones: get(row, "phones").split(/[,/;|\s]+/).map((p) => p.replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10),
      colony: get(row, "colony"),
      address: get(row, "address"),
      mapsUrl: get(row, "mapsUrl"),
    });
  }
  return { ok: true, sites };
}

/** Group parsed lines by document number, keeping file order. */
export function groupByDocument(lines) {
  const map = new Map();
  for (const l of lines) {
    if (!map.has(l.documentNumber)) map.set(l.documentNumber, []);
    map.get(l.documentNumber).push(l);
  }
  return map;
}
