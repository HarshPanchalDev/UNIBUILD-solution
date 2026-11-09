// Column definitions for BUSY exports (spec 8.1 / 8.2).
// [To confirm with BUSY executive] exact column names — add the real header text to `aliases`
// once the export is configured. Matching ignores case, spaces and punctuation.

export const INVOICE_COLUMNS = [
  { key: "invoiceNumber", label: "Invoice number", aliases: ["invoice no", "invoice number", "bill no", "vch no", "voucher no", "voucher number"] },
  { key: "invoiceDate", label: "Invoice date", aliases: ["invoice date", "bill date", "vch date", "voucher date", "date"] },
  { key: "paymentDate", label: "Payment completion date", aliases: ["payment completion date", "payment date", "paid date", "payment completed on"] },
  { key: "siteCode", label: "Site Code", aliases: ["site code", "sitecode", "consignee code", "ship to code"] },
  { key: "itemName", label: "Item name", aliases: ["item name", "item", "product", "product name", "item description"] },
  { key: "category", label: "Category", aliases: ["category", "category 1-5", "category (1-5)", "item category", "product category"] },
  { key: "quantity", label: "Quantity", aliases: ["quantity", "qty"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom"] },
  { key: "taxableValue", label: "Taxable value", aliases: ["taxable value", "taxable value of line", "taxable value of line (₹)", "taxable amount", "taxable"] },
];

export const CREDIT_NOTE_COLUMNS = [
  { key: "creditNoteNumber", label: "Credit note number", aliases: ["credit note number", "credit note no", "cn no", "cn number"] },
  { key: "creditNoteDate", label: "Credit note date", aliases: ["credit note date", "cn date", "date"] },
  { key: "originalInvoiceNumber", label: "Original invoice number", aliases: ["original invoice number", "original invoice no", "against invoice", "invoice no", "invoice number"] },
  { key: "siteCode", label: "Site Code", aliases: ["site code", "sitecode", "consignee code"] },
  { key: "itemName", label: "Item name", aliases: ["item name", "item", "product", "product name"] },
  { key: "category", label: "Category", aliases: ["category", "category 1-5", "category (1-5)", "item category"] },
  { key: "quantity", label: "Quantity", aliases: ["quantity", "qty"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom"] },
  { key: "taxableValue", label: "Taxable value", aliases: ["taxable value", "taxable value of line", "taxable amount", "taxable"] },
];

// Bulk site import from the field survey (Excel/CSV)
export const SITE_IMPORT_COLUMNS = [
  { key: "siteCode", label: "Site Code", aliases: ["site code", "code"] },
  { key: "ownerName", label: "Owner name", aliases: ["owner name", "owner"] },
  { key: "phones", label: "Phone numbers", aliases: ["phone numbers", "phones", "phone", "mobile", "mobile numbers"] },
  { key: "colony", label: "Colony", aliases: ["colony", "area", "locality"] },
  { key: "address", label: "Address", aliases: ["address"], optional: true },
  { key: "mapsUrl", label: "Google Maps link", aliases: ["google maps link", "maps link", "map", "location"], optional: true },
];

export const normalizeHeader = (h) =>
  String(h ?? "")
    .toLowerCase()
    .replace(/₹|\(rs\)|\(inr\)/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Map a header row to column keys. Returns { mapping: {key: index}, missing: [labels] }.
 * An exact label match wins over an alias so "Invoice number" is not taken by "date" aliases etc.
 */
export function mapHeaders(headerRow, columns) {
  const normalized = headerRow.map(normalizeHeader);
  const mapping = {};
  const used = new Set();
  // pass 1: exact label, pass 2: aliases in order
  for (const pass of [0, 1]) {
    for (const col of columns) {
      if (mapping[col.key] !== undefined) continue;
      const candidates = pass === 0 ? [col.label] : col.aliases;
      for (const cand of candidates) {
        const idx = normalized.findIndex((h, i) => !used.has(i) && h && h === normalizeHeader(cand));
        if (idx !== -1) {
          mapping[col.key] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  const missing = columns.filter((c) => !c.optional && mapping[c.key] === undefined).map((c) => c.label);
  return { mapping, missing };
}
