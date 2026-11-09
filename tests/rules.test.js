// Extra business-rule tests (spec section 14 "Also test" list).
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, upload, invoiceCsv, CREDIT_HEADER, T01_ROWS, NOW, daysLater, pointsOf, remainingOf } from "./helpers.js";
import { toCsv, parseCsv } from "../lib/busy/csv.js";
import { parseInvoiceRows } from "../lib/busy/parse.js";
import { parseBusyDate, addMonths } from "../lib/loyalty/dates.js";
import { parseScaled, calcPoints } from "../lib/loyalty/money.js";
import { validateSettings, DEFAULT_SETTINGS } from "../lib/loyalty/settings.js";
import { approvePartner, suspendPartner, reinstatePartner, adjustPoints, rejectPartner } from "../lib/loyalty/partners.js";
import { requestRedemption, rejectRedemption, advanceRedemption } from "../lib/loyalty/redemptions.js";
import { createLink, renewLink } from "../lib/loyalty/links.js";
import { createSite } from "../lib/loyalty/sites.js";
import { updateSettings, getActiveSettings } from "../lib/loyalty/settingsService.js";
import { runDailyJobs } from "../lib/loyalty/jobs.js";
import { createLinkRequest, approveLinkRequest } from "../lib/loyalty/linkRequests.js";
import { can } from "../lib/server/permissions.js";

test("pending partner earns nothing; approval issues a permanent code per trade", async () => {
  const ctx = await setup();
  const p = ctx.repo.seedPartner({ name: "New Painter", trade: "PAINTER", status: "PENDING" });
  await assert.rejects(() => createLink(ctx.repo, { siteId: ctx.site.id, partnerId: p.id, reason: "test link", settings: ctx.settings }), /Only approved/);
  const a = await approvePartner(ctx.repo, { partnerId: p.id, userId: ctx.staff.id });
  assert.equal(a.code, "UBP-PA-0001");
  const p2 = ctx.repo.seedPartner({ name: "Second Painter", trade: "PAINTER", status: "PENDING" });
  const r = await rejectPartner(ctx.repo, { partnerId: p2.id, reason: "Duplicate registration" });
  assert.equal(r.status, "REJECTED");
  const p3 = ctx.repo.seedPartner({ name: "Third Painter", trade: "PAINTER", status: "PENDING" });
  assert.equal((await approvePartner(ctx.repo, { partnerId: p3.id })).code, "UBP-PA-0002"); // codes never reused
  await assert.rejects(() => approvePartner(ctx.repo, { partnerId: p3.id }), /not pending/);
});

test("suspended partner earns no new points and cannot redeem; reinstated can again", async () => {
  const ctx = await setup();
  const reward = ctx.repo.seedReward({ name: "₹500 Voucher", points: 500 });
  await upload(ctx, "INVOICE", invoiceCsv([["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Cement", "1", "800", "Bag", "300000"]]));
  assert.equal(pointsOf(ctx.repo, ctx.contractor.id), 1000);
  await suspendPartner(ctx.repo, { partnerId: ctx.contractor.id, reason: "Under review" });
  const res = await upload(ctx, "INVOICE", invoiceCsv([["UB/2", "2026-11-16", "2026-11-19", "SAL-0012", "Cement", "1", "10", "Bag", "3800"]]));
  assert.equal(res.summary.pointsCredited, 0);
  await assert.rejects(() => requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: daysLater(31), settings: ctx.settings }), (e) => e.details.code === "SUSPENDED");
  await reinstatePartner(ctx.repo, { partnerId: ctx.contractor.id, reason: "Review done" });
  const ok = await requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: daysLater(31), settings: ctx.settings });
  assert.equal(ok.number, "R-0001");
});

test("concurrent redemption requests cannot overspend", async () => {
  const ctx = await setup();
  const reward = ctx.repo.seedReward({ name: "Tool Kit", points: 700 });
  await upload(ctx, "INVOICE", invoiceCsv([["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Cement", "1", "800", "Bag", "300000"]]));
  const later = daysLater(31);
  const results = await Promise.allSettled([
    requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: later, settings: ctx.settings }),
    requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: later, settings: ctx.settings }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 300);
});

test("rejecting a redemption returns the points to the same lots; flow approve → ready → collected", async () => {
  const ctx = await setup();
  const reward = ctx.repo.seedReward({ name: "Helmet", points: 600 });
  await upload(ctx, "INVOICE", invoiceCsv([["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Cement", "1", "800", "Bag", "300000"]]));
  const r1 = await requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: daysLater(31), settings: ctx.settings });
  await assert.rejects(() => rejectRedemption(ctx.repo, { redemptionId: r1.id, reason: "" }), /reason/);
  await rejectRedemption(ctx.repo, { redemptionId: r1.id, reason: "Out of stock", userId: ctx.staff.id });
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 1000);
  const r2 = await requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: daysLater(31), settings: ctx.settings });
  await assert.rejects(() => advanceRedemption(ctx.repo, { redemptionId: r2.id, step: "collect" }), /Cannot collect/);
  await advanceRedemption(ctx.repo, { redemptionId: r2.id, step: "approve" });
  await advanceRedemption(ctx.repo, { redemptionId: r2.id, step: "ready" });
  const done = await advanceRedemption(ctx.repo, { redemptionId: r2.id, step: "collect" });
  assert.equal(done.status, "COLLECTED");
  await assert.rejects(() => rejectRedemption(ctx.repo, { redemptionId: r2.id, reason: "late" }), /Cannot reject/);
});

test("return larger than the balance: never below zero; CAP_AND_FLAG records a shortfall", async () => {
  const ctx = await setup();
  const reward = ctx.repo.seedReward({ name: "Voucher", points: 500 });
  await upload(ctx, "INVOICE", invoiceCsv([["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Cement", "1", "400", "Bag", "150000"]]));
  await requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: daysLater(31), settings: ctx.settings });
  // 500 credited, 500 redeemed → full return of 400 bags must reverse 500, balance is 0
  const res = await upload(ctx, "CREDIT_NOTE", toCsv([CREDIT_HEADER, ["CN/1", "2026-12-25", "UB/1", "SAL-0012", "Cement", "1", "400", "Bag", "150000"]]), { now: daysLater(35) });
  assert.equal(res.summary.pointsReversed, 0);
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 0);
  const sf = ctx.repo.state().shortfalls[0];
  assert.equal(sf.points, 500);
  assert.equal(sf.policy, "CAP_AND_FLAG");
  assert.ok(ctx.repo.state().notifications.some((n) => n.type === "STAFF_SHORTFALL"));
});

test("CARRY_FORWARD policy recovers the shortfall from the next credited points", async () => {
  const ctx = await setup();
  const values = structuredClone((await getActiveSettings(ctx.repo)).values);
  values.shortfallPolicy = "CARRY_FORWARD";
  await updateSettings(ctx.repo, { values, userId: ctx.owner.id });
  const settings = await getActiveSettings(ctx.repo);
  const reward = ctx.repo.seedReward({ name: "Voucher", points: 500 });
  await upload(ctx, "INVOICE", invoiceCsv([["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Cement", "1", "400", "Bag", "150000"]]));
  await requestRedemption(ctx.repo, { partnerId: ctx.contractor.id, rewardId: reward.id, now: daysLater(31), settings });
  await upload(ctx, "CREDIT_NOTE", toCsv([CREDIT_HEADER, ["CN/1", "2026-12-25", "UB/1", "SAL-0012", "Cement", "1", "100", "Bag", "37500"]]), { now: daysLater(35) });
  assert.equal((await ctx.repo.getPartner(ctx.contractor.id)).pendingDeduction, 125);
  await upload(ctx, "INVOICE", invoiceCsv([["UB/2", "2026-12-20", "2026-12-26", "SAL-0012", "Cement", "1", "200", "Bag", "76000"]]), { now: daysLater(36) });
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 250 - 125);
  assert.equal((await ctx.repo.getPartner(ctx.contractor.id)).pendingDeduction, 0);
  assert.equal(ctx.repo.state().shortfalls[0].status, "RECOVERED");
});

test("only one active link per trade per site; renew extends by 12 months", async () => {
  const ctx = await setup();
  const other = ctx.repo.seedPartner({ name: "Other Plumber", trade: "PLUMBER", code: "UBP-PL-0002" });
  await assert.rejects(() => createLink(ctx.repo, { siteId: ctx.site.id, partnerId: other.id, reason: "second plumber", settings: ctx.settings, now: NOW }), /already has an active plumber link/);
  const link = ctx.repo.state().links.find((l) => l.partnerId === ctx.plumber.id);
  const renewed = await renewLink(ctx.repo, { linkId: link.id, reason: "Work continues", settings: ctx.settings });
  assert.equal(renewed.endDate, "2028-11-01");
});

test("invalid rows go to exceptions while valid rows in the same file are credited", async () => {
  const ctx = await setup();
  const res = await upload(ctx, "INVOICE", invoiceCsv([
    ["UB/1", "2026-11-15", "2026-11-19", "", "Cement", "1", "10", "Bag", "3800"],
    ["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Pipe", "9", "1", "Pcs", "500"],
    ["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Pipe", "", "1", "Pcs", "500"],
    ["UB/1", "2026-11-15", "2026-11-19", "SAL-0012", "Pipe", "3", "abc", "Pcs", "500"],
    ["UB/2", "2026-11-15", "2026-11-19", "SAL-0012", "Cement", "1", "8", "Bag", "3040"],
    ["UB/3", "not a date", "2026-11-19", "SAL-0012", "Cement", "1", "8", "Bag", "3040"],
  ]));
  const reasons = ctx.repo.state().exceptions.map((e) => e.reason).sort();
  assert.deepEqual(reasons, ["INVALID_CATEGORY", "INVALID_DATE", "INVALID_VALUE", "MISSING_CATEGORY", "MISSING_SITE_CODE"]);
  assert.equal(res.summary.pointsCredited, 10);
  // re-uploading UB/3 with a correct date closes its date exception
  await upload(ctx, "INVOICE", invoiceCsv([["UB/3", "15-11-2026", "19/11/2026", "SAL-0012", "Cement", "1", "8", "Bag", "3040"]]));
  assert.equal(ctx.repo.state().exceptions.find((e) => e.reason === "INVALID_DATE").status, "RESOLVED");
});

test("points expire after 12 months and an expiry entry is written", async () => {
  const ctx = await setup();
  await upload(ctx, "INVOICE", invoiceCsv(T01_ROWS));
  const settings = await getActiveSettings(ctx.repo);
  await runDailyJobs(ctx.repo, { now: addMonths(NOW, 12), settings });
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 0);
  const expiry = ctx.repo.state().ledger.filter((e) => e.type === "EXPIRY" && e.partnerId === ctx.contractor.id);
  assert.equal(expiry.reduce((s, e) => s + e.points, 0), -125);
});

test("owner adjustment needs a reason and never takes the balance below zero", async () => {
  const ctx = await setup();
  await assert.rejects(() => adjustPoints(ctx.repo, { partnerId: ctx.contractor.id, points: 50, reason: "", settings: ctx.settings }), /reason/);
  await adjustPoints(ctx.repo, { partnerId: ctx.contractor.id, points: 50, reason: "Goodwill for delayed upload", userId: ctx.owner.id, settings: ctx.settings, now: NOW });
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 50);
  await assert.rejects(() => adjustPoints(ctx.repo, { partnerId: ctx.contractor.id, points: -60, reason: "Correction", settings: ctx.settings, now: NOW }), /below zero/);
  await adjustPoints(ctx.repo, { partnerId: ctx.contractor.id, points: -20, reason: "Correction", settings: ctx.settings, now: NOW });
  assert.equal(remainingOf(ctx.repo, ctx.contractor.id), 30);
  assert.ok(ctx.repo.state().notifications.some((n) => n.type === "POINTS_ADJUSTED" && /Correction/.test(n.body)));
});

test("duplicate phone in the same colony warns before creating a site (SITE-01)", async () => {
  const ctx = await setup();
  await assert.rejects(
    () => createSite(ctx.repo, { code: "SAL-0300", ownerName: "Someone", phones: ["98260 12345"], colony: "salaiya" }),
    (e) => e.code === "CONFLICT" && e.details.duplicates[0].code === "SAL-0012"
  );
  const { site } = await createSite(ctx.repo, { areaPrefix: "KOL", ownerName: "Someone", phones: ["9826012345"], colony: "Kolar Road" });
  assert.equal(site.code, "KOL-0001");
});

test("site link request → Store Manager approves new site → partner linked", async () => {
  const ctx = await setup();
  const req = await createLinkRequest(ctx.repo, { partnerId: ctx.contractor.id, input: { type: "NEW_SITE", ownerName: "Rakesh Gupta", phone: "9893011111", colony: "Bawadiya Kalan" } });
  await assert.rejects(() => createLinkRequest(ctx.repo, { partnerId: ctx.contractor.id, input: { type: "EXISTING_SITE", siteCode: "ZZZ-0001" } }), /not found/);
  await approveLinkRequest(ctx.repo, { requestId: req.id, siteCode: "BAW-0001", userId: ctx.staff.id, settings: ctx.settings, now: NOW });
  const link = ctx.repo.state().links.find((l) => l.partnerId === ctx.contractor.id && l.siteId !== ctx.site.id);
  assert.ok(link);
  const site = ctx.repo.state().sites.find((s) => s.code === "BAW-0001");
  assert.equal(site.submittedByPartnerId, ctx.contractor.id);
});

test("settings validation rejects bad values and keeps open decisions empty by default", () => {
  assert.equal(DEFAULT_SETTINGS.tierThresholds.CONTRACTOR.SILVER, null);
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, lockDays: -1 }), /not valid/);
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, tierThresholds: { ...DEFAULT_SETTINGS.tierThresholds, PLUMBER: { SILVER: 50000, GOLD: 40000 } } }), /not valid/);
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, minRedeem: 300 }).minRedeem, 300);
});

test("parser: dates, money and CSV edge cases", () => {
  assert.equal(parseBusyDate("2026-11-14"), "2026-11-14");
  assert.equal(parseBusyDate("14-11-2026"), "2026-11-14");
  assert.equal(parseBusyDate("14/11/26"), "2026-11-14");
  assert.equal(parseBusyDate("14-Nov-2026"), "2026-11-14");
  assert.equal(parseBusyDate(46340), "2026-11-14"); // Excel serial
  assert.equal(parseBusyDate("31-02-2026"), null);
  assert.equal(parseScaled("₹ 12,450.00", 2), 1245000n);
  assert.equal(parseScaled("(100)", 2), -10000n);
  assert.equal(parseScaled("abc", 2), null);
  assert.equal(calcPoints({ basisScaled: 1245000n, basisScale: 2, ratePoints: 1, ratePer: 100, multiplier: 1 }), 124);
  assert.equal(calcPoints({ basisScaled: 100000n, basisScale: 3, ratePoints: 1, ratePer: 1, multiplier: 1.25 }), 125);
  const rows = parseCsv('﻿Invoice No,Bill Date,Payment Date,Site Code,Item,Category,Qty,UOM,Taxable Amount\r\n"UB/1","14-11-2026","19-11-2026",sal-0012,"Pipe, 1"" CPVC",3,2,Pcs,"1,200.50"\r\n');
  const parsed = parseInvoiceRows(rows);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.lines[0].siteCode, "SAL-0012");
  assert.equal(parsed.lines[0].itemName, 'Pipe, 1" CPVC');
  assert.equal(parsed.lines[0].taxableValue, "1200.50");
});

test("permissions: store manager vs owner vs partner", () => {
  assert.equal(can("STORE_MANAGER", "uploads.manage"), true);
  assert.equal(can("STORE_MANAGER", "settings.manage"), false);
  assert.equal(can("STORE_MANAGER", "reports.view"), true);
  assert.equal(can("STORE_MANAGER", "points.adjust"), false);
  assert.equal(can("OWNER", "settings.manage"), true);
  assert.equal(can("OWNER", "staff.manage"), true);
  assert.equal(can("PARTNER", "uploads.manage"), false);
  assert.equal(can(undefined, "reports.view"), false);
});
