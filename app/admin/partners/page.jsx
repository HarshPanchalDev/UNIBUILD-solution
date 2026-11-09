import Link from "next/link";
import { Users } from "lucide-react";
import { Card, PageHeader, StatusBadge, Table, td, Pagination, EmptyState, pageParams, LinkTabs, inputClass, Badge } from "@/components/ui";
import PartnerActions from "@/components/admin/PartnerActions";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDate, tradeName, tierName, q } from "@/lib/server/format";

export const metadata = { title: "Partners · UNIBUILD Admin" };

const STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED", "ALL"];
const TRADES = ["CONTRACTOR", "PLUMBER", "ELECTRICIAN", "PAINTER"];

export default async function PartnersPage({ searchParams }) {
  const s = await requireStaffPage("partners.manage");
  const sp = await searchParams;
  const counts = Object.fromEntries((await prisma.partner.groupBy({ by: ["status"], _count: true })).map((c) => [c.status, c._count]));
  const tab = STATUSES.includes(q(sp.tab)) ? q(sp.tab) : (counts.PENDING ? "PENDING" : "APPROVED");
  const trade = TRADES.includes(q(sp.trade)) ? q(sp.trade) : "";
  const search = q(sp.q).trim().slice(0, 60);
  const digits = search.replace(/\D/g, "");
  const { page, pageSize, skip, take } = pageParams(sp);
  const where = {
    ...(tab === "ALL" ? {} : { status: tab }),
    ...(trade ? { trade } : {}),
    ...(search ? { OR: [{ code: { contains: search.toUpperCase() } }, { user: { name: { contains: search } } }, { areaServed: { contains: search } }, ...(digits.length >= 4 ? [{ user: { mobile: { contains: digits } } }] : [])] } : {}),
  };
  const [partners, total] = await Promise.all([
    prisma.partner.findMany({ where, orderBy: tab === "PENDING" ? { id: "asc" } : { id: "desc" }, skip, take, include: { user: { select: { name: true, mobile: true } }, _count: { select: { links: { where: { activeSlot: { not: null } } } } } } }),
    prisma.partner.count({ where }),
  ]);
  const balances = await prisma.pointLot.groupBy({ by: ["partnerId"], where: { partnerId: { in: partners.map((p) => p.id) }, remaining: { gt: 0 }, expiresAt: { gt: new Date() } }, _sum: { remaining: true } });
  const bal = new Map(balances.map((b) => [b.partnerId, b._sum.remaining ?? 0]));
  const params = { tab, ...(trade ? { trade } : {}), ...(search ? { q: search } : {}) };

  return (
    <>
      <PageHeader title="Partners" subtitle="Contractors, plumbers, electricians and painters. Pending partners can sign in but earn no points until approved." />
      <LinkTabs
        basePath="/admin/partners"
        active={tab}
        params={{ ...(trade ? { trade } : {}), ...(search ? { q: search } : {}) }}
        tabs={[
          { key: "PENDING", label: "Pending approval", count: counts.PENDING ?? 0 },
          { key: "APPROVED", label: "Approved", count: counts.APPROVED ?? 0 },
          { key: "SUSPENDED", label: "Suspended", count: counts.SUSPENDED ?? 0 },
          { key: "REJECTED", label: "Rejected", count: counts.REJECTED ?? 0 },
          { key: "ALL", label: "All" },
        ]}
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={search} placeholder="Name, code, mobile or area" className={`${inputClass} max-w-xs`} aria-label="Search partners" />
        <select name="trade" defaultValue={trade} className={`${inputClass} max-w-[16rem]`} aria-label="Filter by trade">
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t} value={t}>{tradeName(t)}</option>)}
        </select>
        <button className="rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      <Card className="overflow-hidden">
        {partners.length === 0 ? (
          <EmptyState icon={Users} title="No partners here" text={tab === "PENDING" ? "New sign-ups from the partner app will appear here for approval." : undefined} />
        ) : (
          <Table head={["Partner", "Trade", "Mobile", "Area", "Tier", { label: "Balance", right: true }, "Sites", tab === "PENDING" ? "Registered" : "Status", tab === "PENDING" ? "" : null].filter((h) => h !== null)} minWidth={900}>
            {partners.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <td className={td}>
                  <Link href={`/admin/partners/${p.id}`} className="font-semibold text-navy-800 hover:underline">{p.user.name}</Link>
                  <p className="text-xs text-slate-500">{p.code ?? "No code yet"}</p>
                </td>
                <td className={td}>{tradeName(p.trade)}</td>
                <td className={`${td} text-slate-600`}>{p.user.mobile}</td>
                <td className={`${td} text-slate-600`}>{p.areaServed}</td>
                <td className={td}><Badge tone={p.tier}>{tierName(p.tier)}</Badge></td>
                <td className={`${td} text-right font-semibold`}>{(bal.get(p.id) ?? 0).toLocaleString("en-IN")}</td>
                <td className={td}>{p._count.links}</td>
                <td className={td}>{tab === "PENDING" ? fmtDate(p.createdAt) : <StatusBadge status={p.status} />}</td>
                {tab === "PENDING" && (
                  <td className={td}>
                    <PartnerActions compact isOwner={s.user.role === "OWNER"} partner={{ id: p.id, name: p.user.name, code: p.code, trade: p.trade, status: p.status, tier: p.tier }} />
                  </td>
                )}
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/partners" params={params} />
      </Card>
    </>
  );
}
