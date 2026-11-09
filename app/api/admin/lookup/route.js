import { api } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";

// Search used by pickers and the header search box. ?type=partner|site|all&q=…
export const GET = api(async (req) => {
  await requireApiUser({ role: "STAFF" });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const type = url.searchParams.get("type") ?? "all";
  const trade = ["CONTRACTOR", "PLUMBER", "ELECTRICIAN", "PAINTER"].includes(url.searchParams.get("trade")) ? url.searchParams.get("trade") : null;
  if (q.length < 2) return { partners: [], sites: [] };
  const digits = q.replace(/\D/g, "");
  const out = { partners: [], sites: [] };
  if (type === "partner" || type === "all") {
    const ps = await prisma.partner.findMany({
      where: {
        ...(trade ? { trade } : {}),
        ...(url.searchParams.get("approved") === "1" ? { status: "APPROVED" } : {}),
        OR: [{ code: { contains: q.toUpperCase() } }, { user: { name: { contains: q } } }, ...(digits.length >= 4 ? [{ user: { mobile: { contains: digits } } }] : [])],
      },
      include: { user: { select: { name: true, mobile: true } } },
      take: 10,
    });
    out.partners = ps.map((p) => ({ id: p.id, code: p.code, name: p.user.name, mobile: p.user.mobile, trade: p.trade, status: p.status, tier: p.tier }));
  }
  if (type === "site" || type === "all") {
    const ss = await prisma.site.findMany({
      where: {
        status: { not: "MERGED" },
        OR: [{ code: { contains: q.toUpperCase() } }, { ownerName: { contains: q } }, { colony: { contains: q } }, ...(digits.length >= 4 ? [{ phones: { some: { phone: { contains: digits } } } }] : [])],
      },
      take: 10,
    });
    out.sites = ss.map((s) => ({ id: s.id, code: s.code, ownerName: s.ownerName, colony: s.colony, status: s.status }));
  }
  return out;
});
