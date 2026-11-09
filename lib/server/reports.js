import "server-only";
import { prisma } from "./db.js";
import { todayIST, addMonths, addDays, dateOnlyToDate } from "../loyalty/dates.js";
import { TRADE_LABEL, TIER_LABEL } from "../loyalty/constants.js";
import { invalid } from "../loyalty/errors.js";

// Reports (spec 11). Each report returns { title, columns, rows } — the same shape is shown
// on screen and exported to Excel (ADM-02). Aggregation is done in JS over a bounded date range.

export const REPORTS = {
  points: "Points by month",
  "top-partners": "Top partners",
  "linked-share": "Partner-linked paid sales",
  "unlinked-sites": "Unlinked sales by site",
  "reward-costs": "Reward costs",
  activity: "Monthly activity",
};

const IST = 330 * 60000;
const monthOfInstant = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 7);
const monthOfDate = (d) => new Date(d).toISOString().slice(0, 7);
const rupees = (n) => Math.round(Number(n) * 100) / 100;

export function parseRange(searchParams) {
  const today = todayIST();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.to ?? "") ? searchParams.to : today;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.from ?? "") ? searchParams.from : addMonths(to.slice(0, 8) + "01", -5);
  if (from > to) throw invalid("'From' must be before 'To'");
  if (addMonths(from, 24) < to) throw invalid("Choose a range of 24 months or less");
  // instants for timestamp columns: [from 00:00 IST, to+1 00:00 IST)
  const start = new Date(dateOnlyToDate(from).getTime() - IST);
  const end = new Date(dateOnlyToDate(addDays(to, 1)).getTime() - IST);
  return { from, to, start, end, dFrom: dateOnlyToDate(from), dTo: dateOnlyToDate(addDays(to, 1)) };
}

function monthsBetween(from, to) {
  const out = [];
  let m = from.slice(0, 7) + "-01";
  while (m.slice(0, 7) <= to.slice(0, 7)) {
    out.push(m.slice(0, 7));
    m = addMonths(m, 1);
  }
  return out;
}

async function pointsReport(r) {
  const entries = await prisma.ledgerEntry.findMany({ where: { createdAt: { gte: r.start, lt: r.end } }, select: { type: true, points: true, createdAt: true } });
  const rows = new Map(monthsBetween(r.from, r.to).map((m) => [m, { month: m, credited: 0, redeemed: 0, refunded: 0, reversed: 0, expired: 0, adjusted: 0 }]));
  for (const e of entries) {
    const row = rows.get(monthOfInstant(e.createdAt));
    if (!row) continue;
    if (e.type === "CREDIT") row.credited += e.points;
    else if (e.type === "REDEMPTION") row.redeemed += -e.points;
    else if (e.type === "REDEMPTION_REFUND") row.refunded += e.points;
    else if (e.type === "REVERSAL") row.reversed += -e.points;
    else if (e.type === "EXPIRY") row.expired += -e.points;
    else if (e.type === "ADJUSTMENT") row.adjusted += e.points;
  }
  return {
    columns: [
      { key: "month", header: "Month" },
      { key: "credited", header: "Credited", num: true },
      { key: "redeemed", header: "Redeemed", num: true },
      { key: "refunded", header: "Returned (rejected redemptions)", num: true },
      { key: "reversed", header: "Reversed (returns)", num: true },
      { key: "expired", header: "Expired", num: true },
      { key: "adjusted", header: "Manual adjustments (net)", num: true },
    ],
    rows: [...rows.values()],
  };
}

async function topPartners(r) {
  const grouped = await prisma.ledgerEntry.groupBy({ by: ["partnerId"], where: { type: "CREDIT", createdAt: { gte: r.start, lt: r.end } }, _sum: { points: true } });
  grouped.sort((a, b) => (b._sum.points ?? 0) - (a._sum.points ?? 0));
  const top = grouped.slice(0, 50);
  const partners = await prisma.partner.findMany({ where: { id: { in: top.map((g) => g.partnerId) } }, include: { user: { select: { name: true } } } });
  const byId = new Map(partners.map((p) => [p.id, p]));
  return {
    columns: [
      { key: "rank", header: "#", num: true },
      { key: "code", header: "Partner Code" },
      { key: "name", header: "Name" },
      { key: "trade", header: "Trade" },
      { key: "tier", header: "Tier" },
      { key: "points", header: "Points credited", num: true },
    ],
    rows: top.map((g, i) => {
      const p = byId.get(g.partnerId);
      return { rank: i + 1, code: p?.code ?? "", name: p?.user.name ?? "", trade: TRADE_LABEL[p?.trade] ?? "", tier: TIER_LABEL[p?.tier] ?? "", points: g._sum.points ?? 0 };
    }),
  };
}

async function linkedShare(r) {
  const lines = await prisma.invoiceLine.findMany({
    where: { invoice: { paymentDate: { gte: r.dFrom, lt: r.dTo } } },
    select: { status: true, taxableValue: true, invoice: { select: { paymentDate: true } } },
  });
  const rows = new Map(monthsBetween(r.from, r.to).map((m) => [m, { month: m, total: 0, linked: 0, unlinked: 0, walkIn: 0, pending: 0, share: 0 }]));
  for (const l of lines) {
    const row = rows.get(monthOfDate(l.invoice.paymentDate));
    if (!row) continue;
    const v = Number(l.taxableValue);
    row.total += v;
    if (l.status === "CREDITED") row.linked += v;
    else if (l.status === "NO_PARTNER") row.unlinked += v;
    else if (l.status === "WALK_IN") row.walkIn += v;
    else if (l.status === "EXCEPTION") row.pending += v;
  }
  for (const row of rows.values()) {
    for (const k of ["total", "linked", "unlinked", "walkIn", "pending"]) row[k] = rupees(row[k]);
    row.share = row.total ? Math.round((row.linked / row.total) * 1000) / 10 : 0;
  }
  return {
    columns: [
      { key: "month", header: "Month (payment date)" },
      { key: "total", header: "Paid sales ₹ (taxable)", num: true, money: true },
      { key: "linked", header: "Linked to a partner ₹", num: true, money: true },
      { key: "unlinked", header: "Site but no partner ₹", num: true, money: true },
      { key: "walkIn", header: "WALK-IN ₹", num: true, money: true },
      { key: "pending", header: "In exceptions ₹", num: true, money: true },
      { key: "share", header: "Linked share %", num: true },
    ],
    rows: [...rows.values()],
  };
}

async function unlinkedSites(r) {
  const lines = await prisma.invoiceLine.findMany({
    where: { status: "NO_PARTNER", siteId: { not: null }, invoice: { paymentDate: { gte: r.dFrom, lt: r.dTo } } },
    select: { siteId: true, category: true, taxableValue: true },
  });
  const bySite = new Map();
  for (const l of lines) {
    const row = bySite.get(l.siteId) ?? { siteId: l.siteId, lines: 0, value: 0, categories: new Set() };
    row.lines++;
    row.value += Number(l.taxableValue);
    if (l.category) row.categories.add(l.category);
    bySite.set(l.siteId, row);
  }
  const sites = await prisma.site.findMany({ where: { id: { in: [...bySite.keys()] } }, select: { id: true, code: true, colony: true, ownerName: true } });
  const byId = new Map(sites.map((s) => [s.id, s]));
  const rows = [...bySite.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 500)
    .map((x) => ({ code: byId.get(x.siteId)?.code ?? "", colony: byId.get(x.siteId)?.colony ?? "", owner: byId.get(x.siteId)?.ownerName ?? "", lines: x.lines, categories: [...x.categories].sort().join(", "), value: rupees(x.value) }));
  return {
    columns: [
      { key: "code", header: "Site Code" },
      { key: "colony", header: "Colony" },
      { key: "owner", header: "Owner" },
      { key: "categories", header: "Categories (1–5)" },
      { key: "lines", header: "Lines", num: true },
      { key: "value", header: "Taxable value ₹", num: true, money: true },
    ],
    rows,
  };
}

async function rewardCosts(r) {
  const reds = await prisma.redemption.findMany({
    where: { status: { in: ["APPROVED", "READY", "COLLECTED"] }, requestedAt: { gte: r.start, lt: r.end } },
    select: { rewardName: true, points: true, pointValue: true, status: true },
  });
  const by = new Map();
  for (const x of reds) {
    const row = by.get(x.rewardName) ?? { reward: x.rewardName, count: 0, collected: 0, points: 0, cost: 0 };
    row.count++;
    if (x.status === "COLLECTED") row.collected++;
    row.points += x.points;
    row.cost += x.points * Number(x.pointValue);
    by.set(x.rewardName, row);
  }
  const rows = [...by.values()].sort((a, b) => b.cost - a.cost).map((x) => ({ ...x, cost: rupees(x.cost) }));
  return {
    columns: [
      { key: "reward", header: "Reward" },
      { key: "count", header: "Approved redemptions", num: true },
      { key: "collected", header: "Collected", num: true },
      { key: "points", header: "Points", num: true },
      { key: "cost", header: "Cost ₹ (points × point value)", num: true, money: true },
    ],
    rows,
  };
}

async function activity(r) {
  const [invoices, notes, partners, links, reds] = await Promise.all([
    prisma.invoice.findMany({ where: { createdAt: { gte: r.start, lt: r.end } }, select: { createdAt: true } }),
    prisma.creditNote.findMany({ where: { createdAt: { gte: r.start, lt: r.end } }, select: { createdAt: true } }),
    prisma.partner.findMany({ where: { createdAt: { gte: r.start, lt: r.end } }, select: { createdAt: true } }),
    prisma.siteLink.findMany({ where: { createdAt: { gte: r.start, lt: r.end } }, select: { createdAt: true } }),
    prisma.redemption.findMany({ where: { requestedAt: { gte: r.start, lt: r.end } }, select: { requestedAt: true } }),
  ]);
  const rows = new Map(monthsBetween(r.from, r.to).map((m) => [m, { month: m, invoices: 0, creditNotes: 0, signups: 0, links: 0, redemptions: 0 }]));
  const bump = (list, field, key = "createdAt") => list.forEach((x) => { const row = rows.get(monthOfInstant(x[key])); if (row) row[field]++; });
  bump(invoices, "invoices");
  bump(notes, "creditNotes");
  bump(partners, "signups");
  bump(links, "links");
  bump(reds, "redemptions", "requestedAt");
  return {
    columns: [
      { key: "month", header: "Month" },
      { key: "invoices", header: "Paid invoices processed", num: true },
      { key: "creditNotes", header: "Credit notes", num: true },
      { key: "signups", header: "Partner sign-ups", num: true },
      { key: "links", header: "Site links created", num: true },
      { key: "redemptions", header: "Redemption requests", num: true },
    ],
    rows: [...rows.values()],
  };
}

const BUILDERS = { points: pointsReport, "top-partners": topPartners, "linked-share": linkedShare, "unlinked-sites": unlinkedSites, "reward-costs": rewardCosts, activity };

export async function runReport(name, searchParams) {
  const build = BUILDERS[name];
  if (!build) throw invalid("Unknown report");
  const range = parseRange(searchParams);
  const data = await build(range);
  return { name, title: REPORTS[name], range: { from: range.from, to: range.to }, ...data };
}
