// DEVELOPMENT-ONLY demo data. Refuses to run in production.
// Creates sample sites, partners, links and [DEMO] rewards, then pushes samples/paid_invoices_sample.csv
// and samples/credit_notes_sample.csv through the real upload pipeline so you can click around.
// Run after `npm run db:seed`:   npm run db:seed-demo
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { createPrismaRepo } from "../lib/repo/prisma.js";
import { parseCsv } from "../lib/busy/csv.js";
import { processUpload } from "../lib/loyalty/uploads.js";
import { createSite } from "../lib/loyalty/sites.js";
import { createLink } from "../lib/loyalty/links.js";
import { approvePartner } from "../lib/loyalty/partners.js";
import { getActiveSettings } from "../lib/loyalty/settingsService.js";

if (process.env.NODE_ENV === "production" && process.env.STAGING_MODE !== "true") {
  console.error("seed-demo is for development only (or a STAGING_MODE demo server).");
  process.exit(1);
}

const prisma = new PrismaClient();
const repo = createPrismaRepo(prisma);

const PARTNERS = [
  { name: "Ramesh Sharma", mobile: "9826000001", trade: "CONTRACTOR", area: "Salaiya" },
  { name: "Suresh Verma", mobile: "9826000002", trade: "PLUMBER", area: "Salaiya, Kolar Road" },
  { name: "Imran Khan", mobile: "9826000003", trade: "ELECTRICIAN", area: "Bawadiya Kalan" },
  { name: "Mahesh Patel", mobile: "9826000004", trade: "PAINTER", area: "Misrod" },
  { name: "Deepak Yadav", mobile: "9826000005", trade: "CONTRACTOR", area: "Kolar Road", pending: true },
];

const SITES = [
  { code: "SAL-0012", ownerName: "Mohan Sharma", displayName: "Sharma Residence", phones: ["9893010001"], colony: "Salaiya" },
  { code: "SAL-0013", ownerName: "Rakesh Verma", displayName: "Verma House", phones: ["9893010002"], colony: "Salaiya" },
  { code: "KOL-0003", ownerName: "Anil Patel", displayName: "Patel Building", phones: ["9893010003"], colony: "Kolar Road" },
  { code: "BAW-0001", ownerName: "Sunita Gupta", displayName: "Gupta Villa", phones: ["9893010004"], colony: "Bawadiya Kalan" },
];

async function main() {
  const manager = await prisma.user.findFirst({ where: { role: { in: ["STORE_MANAGER", "OWNER"] } } });
  if (!manager) throw new Error("Run `npm run db:seed` first");
  const settings = await getActiveSettings(repo);

  const partnerIds = {};
  for (const p of PARTNERS) {
    let user = await prisma.user.findUnique({ where: { mobile: p.mobile }, include: { partner: true } });
    if (!user) {
      user = await prisma.user.create({
        data: { role: "PARTNER", name: p.name, mobile: p.mobile, partner: { create: { trade: p.trade, areaServed: p.area, termsAcceptedAt: new Date(), whatsappOptIn: true } } },
        include: { partner: true },
      });
      if (!p.pending) await approvePartner(repo, { partnerId: user.partner.id, userId: manager.id });
      console.log(`  + partner ${p.name}${p.pending ? " (pending)" : ""}`);
    }
    partnerIds[p.mobile] = user.partner.id;
  }
  // demo: the first contractor is Silver so the T-01 example (125 points) shows up
  await prisma.partner.update({ where: { id: partnerIds["9826000001"] }, data: { tier: "SILVER" } });

  const siteIds = {};
  for (const s of SITES) {
    const existing = await prisma.site.findUnique({ where: { code: s.code } });
    siteIds[s.code] = existing ? existing.id : (await createSite(repo, { ...s, confirmDuplicates: true }, { userId: manager.id })).site.id;
  }

  const links = [
    ["SAL-0012", "9826000001"], ["SAL-0012", "9826000002"],
    ["SAL-0013", "9826000001"], ["KOL-0003", "9826000003"], ["BAW-0001", "9826000004"],
  ];
  for (const [code, mobile] of links) {
    const partnerId = partnerIds[mobile];
    const p = await prisma.partner.findUnique({ where: { id: partnerId } });
    const active = await prisma.siteLink.findUnique({ where: { activeSlot: `${siteIds[code]}:${p.trade}` } });
    if (!active) await createLink(repo, { siteId: siteIds[code], partnerId, startDate: "2026-11-01", reason: "Demo data", userId: manager.id, settings });
  }

  const rewards = [
    ["[DEMO] ₹500 Gift Voucher", 500, "Vouchers"],
    ["[DEMO] Safety Helmet", 600, "Tools & Equipment"],
    ["[DEMO] UNIBUILD T-Shirt", 750, "Merchandise"],
    ["[DEMO] Tool Kit", 1500, "Tools & Equipment"],
  ];
  for (const [name, points, section] of rewards) {
    if (!(await prisma.reward.findFirst({ where: { name } }))) await prisma.reward.create({ data: { name, points, section, description: "Demo reward — replace with the real catalogue (Q12)" } });
  }

  for (const [kind, file] of [["INVOICE", "samples/paid_invoices_sample.csv"], ["CREDIT_NOTE", "samples/credit_notes_sample.csv"]]) {
    const text = await readFile(file, "utf8");
    const res = await processUpload(repo, { kind, fileName: file.split("/").pop(), fileSize: text.length, rows: parseCsv(text), userId: manager.id });
    console.log(`  ${kind}: ${res.rejected ? `rejected (${res.error})` : `${res.summary.documentsProcessed} processed, ${res.summary.documentsSkipped} skipped, ${res.summary.linesException} exceptions, +${res.summary.pointsCredited} / -${res.summary.pointsReversed} pts`}`);
  }
  console.log("\nDemo partner logins (OTP is printed in the dev server log): 9826000001 … 9826000005");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
