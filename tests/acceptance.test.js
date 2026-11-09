// Acceptance tests T-01 … T-17 from the UNIBUILD spec (section 14). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, upload, invoiceCsv, CREDIT_HEADER, T01_ROWS, NOW, daysLater, lotsOf, pointsOf, remainingOf, updateSettings, INVOICE_HEADER } from "./helpers.js";
import { toCsv } from "../lib/busy/csv.js";
import { lotState, summarizeLots } from "../lib/loyalty/balance.js";
import { createSite, mergeSites, resolveSiteCode } from "../lib/loyalty/sites.js";
import { changeLinkPartner, endLink, createLink } from "../lib/loyalty/links.js";
import { reprocessException } from "../lib/loyalty/exceptions.js";
import { requestRedemption } from "../lib/loyalty/redemptions.js";
import { runDailyJobs } from "../lib/loyalty/jobs.js";
import { getActiveSettings } from "../lib/loyalty/settingsService.js";
import { getPartnerHistory, getPartnerSites, getPartnerSummary } from "../lib/loyalty/partnerViews.js";

test("T-01: 100 bags cement + ₹12,450 plumbing → Silver contractor 125, Saathi plumber 124, both Locked", async () => {
  const ctx = await setup();
  const res = await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  assert.equal(res.rejected, false);
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 125);
  assert.equal(pointsOf(ctx.repo, ctx.plumber.id), 124);
  for (const lot of [...lotsOf(ctx.repo, ctx.contractor.id), ...lotsOf(ctx.repo, ctx.plumber.id)]) {
    assert.equal(lotState(lot, NOW), "LOCKED");
  }
  assert.equal(res.summary.pointsCredited, 249);
  assert.equal(res.summary.documentsProcessed, 1);
  // calculation details are stored on the lot
  const lot = lotsOf(ctx.repo, ctx.contractor.id)[0];
  assert.equal(lot.multiplier, "1.25");
  assert.equal(lot.basisType, "QUANTITY");
});

test("T-02: uploading the same file again credits nothing new", async () => {
  const ctx = await setup();
  const csv = invoiceCsv(T01_ROWS);
  await upload(ctx, "INVOICE", csv);
  const again = await upload(ctx, "INVOICE", csv);
  assert.equal(again.summary.documentsSkipped, 1);
  assert.equal(again.summary.pointsCredited, 0);
  assert.deepEqual(again.summary.skippedNumbers, ["UB/26-27/1045"]);
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 125);
  assert.equal(ctx.repo.state().lots.length, 2);
});

test("T-03: a file missing the Category column is rejected and the column is named", async () => {
  const ctx = await setup();
  const header = INVOICE_HEADER.filter((h) => h !== "Category");
  const rows = T01_ROWS.map((r) => r.filter((_, i) => i !== 5));
  const res = await upload(ctx, "INVOICE", invoiceCsv(rows, header));
  assert.equal(res.rejected, true);
  assert.deepEqual(res.missing, ["Category"]);
  assert.match(res.error, /Category/);
  assert.equal(ctx.repo.state().invoices.length, 0);
  assert.equal(ctx.repo.state().batches.at(-1).status, "REJECTED");
});

test("T-04: unknown Site Code goes to exceptions; after creating the site and re-processing, points are credited once", async () => {
  const ctx = await setup();
  const res = await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/2001", "2026-11-15", "2026-11-19", "SAL-0189", "PPC Cement", "1", "40", "Bag", "15,200.00"]]));
  assert.equal(res.summary.linesException, 1);
  const ex = ctx.repo.state().exceptions[0];
  assert.equal(ex.reason, "UNKNOWN_SITE_CODE");
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 0);

  await assert.rejects(() => reprocessException(ctx.repo, { exceptionId: ex.id, userId: ctx.staff.id, now: NOW }), /not in the app/);

  const { site } = await createSite(ctx.repo, { code: "SAL-0189", ownerName: "Anil Verma", phones: ["9826099999"], colony: "Salaiya" }, { userId: ctx.staff.id });
  await createLink(ctx.repo, { siteId: site.id, partnerId: ctx.contractor.id, startDate: "2026-11-10", reason: "Verified at counter", userId: ctx.staff.id, now: NOW, settings: ctx.settings });
  const out = await reprocessException(ctx.repo, { exceptionId: ex.id, userId: ctx.staff.id, now: NOW });
  assert.equal(out.status, "CREDITED");
  assert.equal(out.points, 50); // 40 bags × 1.25
  await assert.rejects(() => reprocessException(ctx.repo, { exceptionId: ex.id, userId: ctx.staff.id, now: NOW }), /already closed/);
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 50);
});

test("T-05: WALK-IN lines are ignored and are not exceptions", async () => {
  const ctx = await setup();
  const res = await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/3001", "2026-11-15", "2026-11-19", "WALK-IN", "Paint 10L", "5", "1", "Can", "4,000.00"]]));
  assert.equal(res.summary.linesIgnored, 1);
  assert.equal(res.summary.linesException, 0);
  assert.equal(ctx.repo.state().exceptions.length, 0);
  assert.equal(ctx.repo.state().lots.length, 0);
});

test("T-06: an invoice dated before the link start earns no points, even if paid later", async () => {
  const ctx = await setup();
  const res = await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/0999", "2026-10-28", "2026-11-19", "SAL-0012", "PPC Cement", "1", "100", "Bag", "38,000.00"]]));
  assert.equal(res.summary.pointsCredited, 0);
  assert.equal(res.summary.linesUnlinked, 1);
  assert.equal(ctx.repo.state().invoiceLines[0].status, "NO_PARTNER");
});

test("T-07: no electrician linked → electrical earns nothing, other categories are credited", async () => {
  const ctx = await setup();
  const res = await upload(
    ctx,
    "INVOICE",
    invoiceCsv([
      ["UB/26-27/4001", "2026-11-15", "2026-11-19", "SAL-0012", "Copper wire 1.5mm", "4", "5", "Coil", "9,800.00"],
      ["UB/26-27/4001", "2026-11-15", "2026-11-19", "SAL-0012", "PPC Cement", "1", "20", "Bag", "7,600.00"],
    ])
  );
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 25);
  assert.equal(res.summary.linesUnlinked, 1);
  const electrical = ctx.repo.state().invoiceLines.find((l) => l.category === 4);
  assert.equal(electrical.status, "NO_PARTNER");
});

test("T-08: points stay Locked for 30 days and become Available on day 31", async () => {
  const ctx = await setup();
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  const lots = lotsOf(ctx.repo, ctx.contractor.id);
  assert.equal(summarizeLots(lots, daysLater(29)).available, 0);
  assert.equal(summarizeLots(lots, daysLater(29)).locked, 125);
  assert.equal(summarizeLots(lots, daysLater(31)).available, 125);
  assert.equal(lotState(lots[0], daysLater(31)), "AVAILABLE");
  // the daily job tells the partner once
  const settings = await getActiveSettings(ctx.repo);
  await runDailyJobs(ctx.repo, { now: daysLater(31), settings });
  await runDailyJobs(ctx.repo, { now: daysLater(31.5), settings });
  const notices = ctx.repo.state().notifications.filter((n) => n.type === "POINTS_UNLOCKED" && n.userId === ctx.contractor.userId);
  assert.equal(notices.length, 1);
});

test("T-09: credit note for 10 bags reverses from the original contractor at the original multiplier, with a notice", async () => {
  const ctx = await setup();
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  const res = await upload(ctx, "CREDIT_NOTE", toCsv([CREDIT_HEADER, ["CN/26-27/0045", "2026-11-21", "UB/26-27/1045", "SAL-0012", "PPC Cement 50 kg", "1", "10", "Bag", "3,800.00"]]), { now: daysLater(1) });
  // 100 bags → 125; net 90 bags → floor(112.5) = 112; reversal = 13 (= 10 × 1.25 rounded so totals stay exact)
  assert.equal(res.summary.pointsReversed, 13);
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 112);
  assert.equal(remainingOf(ctx.repo, ctx.plumber.id), 124);
  const notice = ctx.repo.state().notifications.find((n) => n.type === "POINTS_REVERSED");
  assert.equal(notice.userId, ctx.contractor.userId);
  assert.match(notice.body, /10 Bag/);
  assert.match(notice.body, /13 points deducted/);
  // duplicate credit note is skipped
  const again = await upload(ctx, "CREDIT_NOTE", toCsv([CREDIT_HEADER, ["CN/26-27/0045", "2026-11-21", "UB/26-27/1045", "SAL-0012", "PPC Cement 50 kg", "1", "10", "Bag", "3,800.00"]]), { now: daysLater(1) });
  assert.equal(again.summary.documentsSkipped, 1);
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 112);
});

test("T-10: a credit note uploaded before its invoice is paid is netted when the invoice arrives", async () => {
  const ctx = await setup();
  const cn = await upload(ctx, "CREDIT_NOTE", toCsv([CREDIT_HEADER, ["CN/26-27/0050", "2026-11-18", "UB/26-27/1045", "SAL-0012", "PPC Cement 50 kg", "1", "10", "Bag", "3,800.00"]]));
  assert.equal(cn.summary.linesPending, 1);
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS), { now: daysLater(1) });
  // net 90 bags × 1.25 = 112 — the same result as reversing after payment (T-09)
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 112);
  assert.equal(ctx.repo.state().creditLines[0].status, "APPLIED_NET");
  assert.equal(pointsOf(ctx.repo, ctx.plumber.id), 124);
});

test("T-11: when the partner changes, earlier points stay with the old partner and new invoices go to the new one", async () => {
  const ctx = await setup();
  await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/5001", "2026-11-10", "2026-11-12", "SAL-0012", "PPC Cement", "1", "40", "Bag", "15,200.00"]]));
  const newContractor = ctx.repo.seedPartner({ name: "Vikas Contractor", trade: "CONTRACTOR", tier: "SAATHI", code: "UBP-CO-0002" });
  const link = ctx.repo.state().links.find((l) => l.partnerId === ctx.contractor.id && l.activeSlot);
  await changeLinkPartner(ctx.repo, { linkId: link.id, newPartnerId: newContractor.id, date: "2026-11-18", reason: "Owner changed contractor", userId: ctx.staff.id, now: NOW, settings: ctx.settings });
  await upload(ctx, "INVOICE", invoiceCsv([
    ["UB/26-27/5002", "2026-11-17", "2026-11-19", "SAL-0012", "PPC Cement", "1", "8", "Bag", "3,040.00"], // before change → old partner
    ["UB/26-27/5003", "2026-11-18", "2026-11-19", "SAL-0012", "PPC Cement", "1", "20", "Bag", "7,600.00"], // change day → new partner
  ]));
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 50 + 10);
  assert.equal(pointsOf(ctx.repo, newContractor.id), 20);
  // a return on the old invoice still comes from the old partner (RET-02)
  await upload(ctx, "CREDIT_NOTE", toCsv([CREDIT_HEADER, ["CN/26-27/0060", "2026-11-20", "UB/26-27/5001", "SAL-0012", "PPC Cement", "1", "40", "Bag", "15,200.00"]]));
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 10);
  assert.equal(remainingOf(ctx.repo, newContractor.id), 20);
});

test("T-12: a link expires after 12 months; a reminder is created 30 days before", async () => {
  const ctx = await setup();
  const settings = await getActiveSettings(ctx.repo);
  const link = ctx.repo.state().links.find((l) => l.partnerId === ctx.contractor.id);
  assert.equal(link.endDate, "2027-11-01");
  await runDailyJobs(ctx.repo, { now: new Date("2027-09-30T06:00:00Z"), settings }); // 32 days before
  assert.equal(ctx.repo.state().notifications.filter((n) => n.type === "STAFF_LINK_EXPIRING").length, 0);
  await runDailyJobs(ctx.repo, { now: new Date("2027-10-02T06:00:00Z"), settings }); // 30 days before
  assert.equal(ctx.repo.state().notifications.filter((n) => n.type === "STAFF_LINK_EXPIRING").length, 2);
  assert.equal(ctx.repo.state().notifications.filter((n) => n.type === "LINK_EXPIRING" && n.userId === ctx.contractor.userId).length, 1);
  await runDailyJobs(ctx.repo, { now: new Date("2027-11-01T06:00:00Z"), settings });
  const after = ctx.repo.state().links.find((l) => l.id === link.id);
  assert.equal(after.status, "EXPIRED");
  assert.equal(after.activeSlot, null);
  // an invoice dated on/after the expiry earns nothing
  const res = await upload(ctx, "INVOICE", invoiceCsv([["UB/27-28/0001", "2027-11-02", "2027-11-03", "SAL-0012", "PPC Cement", "1", "10", "Bag", "3,800.00"]]), { now: new Date("2027-11-03T06:00:00Z") });
  assert.equal(res.summary.pointsCredited, 0);
});

test("T-13: redemption below the minimum or above Available is blocked", async () => {
  const ctx = await setup();
  const big = ctx.repo.seedReward({ name: "Drill Machine", points: 3500 });
  const small = ctx.repo.seedReward({ name: "₹100 Voucher", points: 100 });
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  // 125 points but still locked
  await assert.rejects(() => requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: small.id, now: NOW, settings: ctx.settings }), (e) => e.details.code === "BELOW_MINIMUM");
  // unlocked but 125 < 500 minimum
  await assert.rejects(() => requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: small.id, now: daysLater(31), settings: ctx.settings }), (e) => e.details.code === "BELOW_MINIMUM");
  await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/6001", "2026-11-15", "2026-11-19", "SAL-0012", "PPC Cement", "1", "500", "Bag", "190,000.00"]]));
  // 625 + 125 = 750 available after 31 days; drill needs 3500
  await assert.rejects(() => requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: big.id, now: daysLater(31), settings: ctx.settings }), (e) => e.details.code === "INSUFFICIENT");
  const ok = await requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: small.id, now: daysLater(31), settings: ctx.settings });
  assert.equal(ok.status, "REQUESTED");
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 650);
});

test("T-14: a new earning rate applies only to files uploaded after the change", async () => {
  const ctx = await setup();
  await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/7001", "2026-11-15", "2026-11-19", "SAL-0012", "CPVC Pipe", "3", "10", "Pcs", "10,000.00"]]));
  const current = await getActiveSettings(ctx.repo);
  const values = structuredClone(current.values);
  values.rates[3] = { basis: "VALUE", points: 2, per: 100 };
  await updateSettings(ctx.repo, { values, userId: ctx.owner.id, note: "Plumbing promotion" });
  await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/7002", "2026-11-16", "2026-11-19", "SAL-0012", "CPVC Pipe", "3", "10", "Pcs", "10,000.00"]]));
  const lots = lotsOf(ctx.repo, ctx.plumber.id).sort((a, b) => a.id - b.id);
  assert.deepEqual(lots.map((l) => l.points), [100, 200]);
  assert.notEqual(lots[0].settingsVersionId, lots[1].settingsVersionId);
  // an exception from the old file is re-processed with the OLD rate
  await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/7003", "2026-11-16", "2026-11-19", "", "CPVC Pipe", "3", "10", "Pcs", "10,000.00"]]));
  const ex = ctx.repo.state().exceptions.at(-1);
  const values2 = structuredClone(values);
  values2.rates[3] = { basis: "VALUE", points: 5, per: 100 };
  await updateSettings(ctx.repo, { values: values2, userId: ctx.owner.id, note: "Another change" });
  const out = await reprocessException(ctx.repo, { exceptionId: ex.id, fix: { siteCode: "SAL-0012" }, userId: ctx.staff.id, now: NOW });
  assert.equal(out.points, 200);
  assert.equal(ctx.repo.state().audit.filter((a) => a.action === "SETTINGS_UPDATE").length, 2);
});

test("T-15: merging two sites keeps history and later invoices with the old code resolve to the survivor", async () => {
  const ctx = await setup();
  const { site: dupSite } = await createSite(ctx.repo, { code: "SAL-0201", ownerName: "Mohan Sharma", phones: ["9826012345"], colony: "Salaiya", confirmDuplicates: true }, { userId: ctx.staff.id });
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  const res = await mergeSites(ctx.repo, { codeA: "SAL-0201", codeB: "SAL-0012", reason: "Same house, created twice at counter", userId: ctx.staff.id });
  assert.equal(res.survivor.code, "SAL-0012"); // older survives
  assert.equal((await resolveSiteCode(ctx.repo, "SAL-0201")).code, "SAL-0012");
  assert.equal(ctx.repo.state().sites.find((s) => s.id === dupSite.id).status, "MERGED");
  await upload(ctx, "INVOICE", invoiceCsv([["UB/26-27/8001", "2026-11-16", "2026-11-19", "SAL-0201", "PPC Cement", "1", "8", "Bag", "3,040.00"]]));
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 125 + 10);
  assert.equal(ctx.repo.state().lots.every((l) => l.siteId === ctx.site.id), true);
  // the merged code can never be reused
  await assert.rejects(() => createSite(ctx.repo, { code: "SAL-0201", ownerName: "X Y", phones: ["9000000001"], colony: "Kolar" }), /never reused/);
});

test("T-16: a partner sees only their own points and sites, without invoice money or owner details", async () => {
  const ctx = await setup();
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  const history = await getPartnerHistory(ctx.repo, ctx.contractor.id, { now: NOW });
  assert.equal(history.length, 1);
  assert.equal(history[0].points, 125);
  const json = JSON.stringify(history);
  for (const forbidden of ["38000", "38,000", "12450", "taxable", "Mohan", "9826012345", "UB/26-27/1045", "invoice"]) {
    assert.equal(json.toLowerCase().includes(forbidden.toLowerCase()), false, `history leaks ${forbidden}`);
  }
  const sites = await getPartnerSites(ctx.repo, ctx.contractor.id, { now: NOW });
  assert.equal(sites.length, 1);
  assert.equal(sites[0].site.code, "SAL-0012");
  assert.equal(sites[0].site.ownerName, undefined);
  assert.equal(JSON.stringify(sites).includes("9826012345"), false);
  const plumberHistory = await getPartnerHistory(ctx.repo, ctx.plumber.id, { now: NOW });
  assert.equal(plumberHistory.every((h) => h.points === 124), true);
  const summary = await getPartnerSummary(ctx.repo, ctx.contractor.id, { now: NOW, settings: ctx.settings });
  assert.equal(summary.locked, 125);
  assert.equal(summary.available, 0);
});

test("T-17: changing a link writes the user, time and reason to the audit log", async () => {
  const ctx = await setup();
  const link = ctx.repo.state().links.find((l) => l.partnerId === ctx.plumber.id);
  await endLink(ctx.repo, { linkId: link.id, reason: "Plumber left the site", userId: ctx.staff.id, now: NOW });
  const entry = ctx.repo.state().audit.find((a) => a.action === "LINK_END");
  assert.equal(entry.userId, ctx.staff.id);
  assert.equal(entry.reason, "Plumber left the site");
  assert.ok(entry.createdAt instanceof Date);
  assert.equal(entry.entityId, String(link.id));
  await assert.rejects(() => endLink(ctx.repo, { linkId: link.id, reason: "", userId: ctx.staff.id }), /reason is required/);
});
