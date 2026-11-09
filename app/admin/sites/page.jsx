import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, PageHeader, StatusBadge, Table, td, Pagination, EmptyState, pageParams, inputClass, LinkTabs } from "@/components/ui";
import SiteForm from "@/components/admin/SiteForm";
import { MergeSitesButton, ImportSitesButton } from "@/components/admin/SiteTools";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDate, q, tradeName } from "@/lib/server/format";

export const metadata = { title: "Sites · UNIBUILD Admin" };

export default async function SitesPage({ searchParams }) {
  await requireStaffPage("sites.manage");
  const sp = await searchParams;
  const search = q(sp.q).trim().slice(0, 60);
  const tab = ["ACTIVE", "COMPLETED", "INCOMPLETE", "ALL"].includes(q(sp.tab)) ? q(sp.tab) : "ACTIVE";
  const { page, pageSize, skip, take } = pageParams(sp);
  const digits = search.replace(/\D/g, "");
  const where = {
    status: { not: "MERGED" },
    ...(tab === "ACTIVE" ? { status: "ACTIVE" } : tab === "COMPLETED" ? { status: "COMPLETED" } : tab === "INCOMPLETE" ? { isIncomplete: true, status: { not: "MERGED" } } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search.toUpperCase() } },
            { ownerName: { contains: search } },
            { colony: { contains: search } },
            { displayName: { contains: search } },
            ...(digits.length >= 4 ? [{ phones: { some: { phone: { contains: digits } } } }] : []),
            { aliases: { some: { alias: { contains: search.toUpperCase() } } } },
          ],
        }
      : {}),
  };
  const [sites, total, incomplete] = await Promise.all([
    prisma.site.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take,
      include: { phones: true, links: { where: { activeSlot: { not: null } }, select: { trade: true } } },
    }),
    prisma.site.count({ where }),
    prisma.site.count({ where: { isIncomplete: true, status: { not: "MERGED" } } }),
  ]);
  const newCode = q(sp.new).toUpperCase().slice(0, 20);

  return (
    <>
      <PageHeader
        title="Sites"
        subtitle="Every invoice carries one UNIBUILD Site Code. Codes are permanent and never reused."
        action={
          <>
            <ImportSitesButton />
            <MergeSitesButton />
            <SiteForm initialCode={newCode} openInitially={Boolean(sp.new)} />
          </>
        }
      />
      <LinkTabs
        basePath="/admin/sites"
        active={tab}
        params={search ? { q: search } : {}}
        tabs={[
          { key: "ACTIVE", label: "Active" },
          { key: "COMPLETED", label: "Completed" },
          { key: "INCOMPLETE", label: "Needs details", count: incomplete },
          { key: "ALL", label: "All" },
        ]}
      />
      <form method="get" className="mb-4 flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={search} placeholder="Search code, owner, phone or colony" className={`${inputClass} max-w-md`} aria-label="Search sites" />
        <button className="rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <Card className="overflow-hidden">
        {sites.length === 0 ? (
          <EmptyState icon={MapPin} title={search ? "No sites match your search" : "No sites yet"} text={search ? "Try a phone number, owner name or colony." : "Create sites here, import the field survey, or they arrive from BUSY uploads."} />
        ) : (
          <Table head={["Site Code", "Owner", "Phones", "Colony", "Linked trades", "Created", "Status"]} minWidth={860}>
            {sites.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/admin/sites/${s.id}`} className="font-semibold text-navy-800 hover:underline">{s.code}</Link>
                  {s.displayName && <p className="text-xs text-slate-500">{s.displayName}</p>}
                </td>
                <td className={`${td} text-navy-900`}>{s.ownerName}</td>
                <td className={`${td} text-slate-600`}>{s.phones.map((p) => p.phone).join(", ")}</td>
                <td className={`${td} text-slate-600`}>{s.colony}</td>
                <td className={`${td} text-slate-600`}>{s.links.length ? s.links.map((l) => tradeName(l.trade)).join(", ") : <span className="text-slate-400">None</span>}</td>
                <td className={`${td} whitespace-nowrap text-slate-600`}>{fmtDate(s.createdAt)}<p className="text-xs text-slate-400">{s.source.replace(/_/g, " ").toLowerCase()}</p></td>
                <td className={td}>
                  <StatusBadge status={s.status} />
                  {s.isIncomplete && <p className="mt-1 text-xs text-amber-600">Needs details</p>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/sites" params={{ tab, ...(search ? { q: search } : {}) }} />
      </Card>
    </>
  );
}
