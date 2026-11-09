import Link from "next/link";
import { Search } from "lucide-react";
import { Card, PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { tradeName, q } from "@/lib/server/format";

export default async function SearchPage({ searchParams }) {
  await requireStaffPage();
  const sp = await searchParams;
  const term = q(sp.q).trim().slice(0, 60);
  const digits = term.replace(/\D/g, "");
  const [partners, sites, redemptions] = term.length < 2 ? [[], [], []] : await Promise.all([
    prisma.partner.findMany({ where: { OR: [{ code: { contains: term.toUpperCase() } }, { user: { name: { contains: term } } }, ...(digits.length >= 4 ? [{ user: { mobile: { contains: digits } } }] : [])] }, include: { user: { select: { name: true, mobile: true } } }, take: 20 }),
    prisma.site.findMany({ where: { OR: [{ code: { contains: term.toUpperCase() } }, { ownerName: { contains: term } }, { colony: { contains: term } }, { aliases: { some: { alias: { contains: term.toUpperCase() } } } }, ...(digits.length >= 4 ? [{ phones: { some: { phone: { contains: digits } } } }] : [])] }, take: 20 }),
    prisma.redemption.findMany({ where: { number: { contains: term.toUpperCase() } }, take: 10 }),
  ]);
  const none = partners.length + sites.length + redemptions.length === 0;
  return (
    <>
      <PageHeader title="Search" subtitle={term ? `Results for “${term}”` : "Search partners, sites, phone numbers and redemption numbers."} />
      {term.length < 2 || none ? (
        <Card><EmptyState icon={Search} title={term.length < 2 ? "Type at least 2 characters" : "Nothing found"} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-2 font-semibold text-navy-900">Partners ({partners.length})</p>
            <ul className="divide-y divide-slate-100">
              {partners.map((p) => (
                <li key={p.id}><Link href={`/admin/partners/${p.id}`} className="flex items-center justify-between py-2.5 hover:text-navy-600"><span><b>{p.user.name}</b> <span className="text-sm text-slate-500">· {p.code ?? "no code"} · {tradeName(p.trade)} · {p.user.mobile}</span></span><StatusBadge status={p.status} /></Link></li>
              ))}
              {partners.length === 0 && <li className="py-3 text-sm text-slate-500">No partners</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="mb-2 font-semibold text-navy-900">Sites ({sites.length})</p>
            <ul className="divide-y divide-slate-100">
              {sites.map((s) => (
                <li key={s.id}><Link href={`/admin/sites/${s.id}`} className="flex items-center justify-between py-2.5 hover:text-navy-600"><span><b>{s.code}</b> <span className="text-sm text-slate-500">· {s.ownerName} · {s.colony}</span></span><StatusBadge status={s.status} /></Link></li>
              ))}
              {sites.length === 0 && <li className="py-3 text-sm text-slate-500">No sites</li>}
            </ul>
          </Card>
          {redemptions.length > 0 && (
            <Card className="p-5">
              <p className="mb-2 font-semibold text-navy-900">Redemptions</p>
              <ul className="divide-y divide-slate-100">{redemptions.map((r) => <li key={r.id} className="flex justify-between py-2.5"><Link href="/admin/redemptions?tab=ALL" className="font-medium">{r.number} · {r.rewardName}</Link><StatusBadge status={r.status} /></li>)}</ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
