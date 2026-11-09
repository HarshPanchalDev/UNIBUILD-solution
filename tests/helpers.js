// Shared fixtures for the acceptance tests (spec section 14).
import { createMemoryRepo } from "../lib/repo/memory.js";
import { parseCsv, toCsv } from "../lib/busy/csv.js";
import { processUpload } from "../lib/loyalty/uploads.js";
import { createSite } from "../lib/loyalty/sites.js";
import { createLink } from "../lib/loyalty/links.js";
import { getActiveSettings, updateSettings } from "../lib/loyalty/settingsService.js";

export const NOW = new Date("2026-11-20T06:30:00Z"); // 20 Nov 2026, 12:00 IST
export const daysLater = (d, base = NOW) => new Date(base.getTime() + d * 86400000);

export const INVOICE_HEADER = ["Invoice number", "Invoice date", "Payment completion date", "Site Code", "Item name", "Category", "Quantity", "Unit", "Taxable value"];
export const CREDIT_HEADER = ["Credit note number", "Credit note date", "Original invoice number", "Site Code", "Item name", "Category", "Quantity", "Unit", "Taxable value"];

export function invoiceCsv(rows, header = INVOICE_HEADER) {
  return toCsv([header, ...rows]);
}

export async function setup() {
  const repo = createMemoryRepo();
  const staff = repo.seedUser({ role: "STORE_MANAGER", name: "Store Manager", email: "sm@test" });
  const owner = repo.seedUser({ role: "OWNER", name: "Owner", email: "owner@test" });
  const settings = await getActiveSettings(repo);
  const contractor = repo.seedPartner({ name: "Ramesh Contractor", trade: "CONTRACTOR", tier: "SILVER", code: "UBP-CO-0001" });
  const plumber = repo.seedPartner({ name: "Suresh Plumber", trade: "PLUMBER", tier: "SAATHI", code: "UBP-PL-0001" });
  const { site } = await createSite(repo, { code: "SAL-0012", ownerName: "Mohan Sharma", phones: ["9826012345"], colony: "Salaiya" }, { userId: staff.id });
  await createLink(repo, { siteId: site.id, partnerId: contractor.id, startDate: "2026-11-01", reason: "Contractor confirmed on site", userId: staff.id, now: NOW, settings });
  await createLink(repo, { siteId: site.id, partnerId: plumber.id, startDate: "2026-11-01", reason: "Plumber confirmed on site", userId: staff.id, now: NOW, settings });
  return { repo, staff, owner, settings, contractor, plumber, site };
}

export async function upload(ctx, kind, csv, { now = NOW, fileName = "upload.csv" } = {}) {
  return processUpload(ctx.repo, { kind, fileName, fileSize: csv.length, rows: parseCsv(csv), userId: ctx.staff.id, now });
}

/** The T-01 invoice: 100 bags cement + ₹12,450 plumbing on SAL-0012 */
export const T01_ROWS = [
  ["UB/26-27/1045", "2026-11-14", "2026-11-19", "SAL-0012", "PPC Cement 50 kg", "1", "100", "Bag", "38,000.00"],
  ["UB/26-27/1045", "2026-11-14", "2026-11-19", "SAL-0012", "CPVC Pipe 1 inch", "3", "30", "Pcs", "12,450.00"],
];

export const lotsOf = (repo, partnerId) => repo.state().lots.filter((l) => l.partnerId === partnerId);
export const pointsOf = (repo, partnerId) => lotsOf(repo, partnerId).reduce((s, l) => s + l.points, 0);
export const remainingOf = (repo, partnerId) => lotsOf(repo, partnerId).reduce((s, l) => s + l.remaining, 0);

export { updateSettings };
