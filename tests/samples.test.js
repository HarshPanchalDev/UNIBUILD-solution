// The sample files in /samples must parse and behave as documented in README.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryRepo } from "../lib/repo/memory.js";
import { parseCsv } from "../lib/busy/csv.js";
import { parseSiteImportRows } from "../lib/busy/parse.js";
import { processUpload } from "../lib/loyalty/uploads.js";
import { createSite } from "../lib/loyalty/sites.js";
import { createLink } from "../lib/loyalty/links.js";
import { getActiveSettings } from "../lib/loyalty/settingsService.js";

const read = (f) => parseCsv(readFileSync(new URL(`../samples/${f}`, import.meta.url), "utf8"));
const NOW = new Date("2026-11-20T06:30:00Z");

test("sample paid-invoice and credit-note files work end to end", async () => {
  const repo = createMemoryRepo();
  const staff = repo.seedUser({ role: "STORE_MANAGER", name: "SM" });
  const settings = await getActiveSettings(repo);
  const partners = {
    co: repo.seedPartner({ name: "Ramesh", trade: "CONTRACTOR", tier: "SILVER", code: "UBP-CO-0001" }),
    pl: repo.seedPartner({ name: "Suresh", trade: "PLUMBER", code: "UBP-PL-0001" }),
    el: repo.seedPartner({ name: "Imran", trade: "ELECTRICIAN", code: "UBP-EL-0001" }),
    pa: repo.seedPartner({ name: "Mahesh", trade: "PAINTER", code: "UBP-PA-0001" }),
  };
  const sites = {};
  for (const [code, colony, phone] of [["SAL-0012", "Salaiya", "9893010001"], ["SAL-0013", "Salaiya", "9893010002"], ["KOL-0003", "Kolar Road", "9893010003"], ["BAW-0001", "Bawadiya Kalan", "9893010004"]]) {
    sites[code] = (await createSite(repo, { code, ownerName: "Owner", phones: [phone], colony })).site;
  }
  for (const [code, p] of [["SAL-0012", "co"], ["SAL-0012", "pl"], ["SAL-0013", "co"], ["KOL-0003", "el"], ["BAW-0001", "pa"]]) {
    await createLink(repo, { siteId: sites[code].id, partnerId: partners[p].id, startDate: "2026-11-01", reason: "demo", settings, now: NOW });
  }
  const inv = await processUpload(repo, { kind: "INVOICE", fileName: "paid_invoices_sample.csv", rows: read("paid_invoices_sample.csv"), userId: staff.id, now: NOW });
  // 125 + 124 (T-01) + 60 bags×1.25=75 + ₹8,400×1.25=105 (Silver contractor) + electrical ₹13,100=131 + paint ₹15,750=157 = 717
  assert.equal(inv.summary.pointsCredited, 717);
  assert.equal(inv.summary.linesIgnored, 1); // WALK-IN
  assert.equal(inv.summary.linesException, 2); // unknown SAL-0189 + missing site code
  const cn = await processUpload(repo, { kind: "CREDIT_NOTE", fileName: "credit_notes_sample.csv", rows: read("credit_notes_sample.csv"), userId: staff.id, now: NOW });
  assert.equal(cn.summary.pointsReversed, 13);
  const broken = await processUpload(repo, { kind: "INVOICE", fileName: "x.csv", rows: read("paid_invoices_missing_category.csv"), userId: staff.id, now: NOW });
  assert.equal(broken.rejected, true);
  assert.deepEqual(broken.missing, ["Category"]);
});

test("sample site import file parses", () => {
  const r = parseSiteImportRows(read("sites_import_sample.csv"));
  assert.equal(r.ok, true);
  assert.equal(r.sites.length, 3);
  assert.deepEqual(r.sites[0].phones, ["9826012345", "9826054321"]);
  assert.equal(r.sites[2].code, "");
});
