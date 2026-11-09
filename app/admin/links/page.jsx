import Link from "next/link";
import { Link2, Inbox } from "lucide-react";
import { Card, PageHeader, StatusBadge, Table, td, Pagination, EmptyState, pageParams, LinkTabs, Badge, inputClass } from "@/components/ui";
import { CreateLinkButton, LinkRowActions, LinkRequestActions } from "@/components/admin/LinkTools";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDay, fmtDateTime, tradeName, q } from "@/lib/server/format";
import { todayIST, addDays, dateOnlyToDate } from "@/lib/loyalty/dates";

export const metadata = { title: "Links · UNIBUILD Admin" };

const TABS = ["active", "expiring", "ended", "requests", "all"];

export default async function LinksPage({ searchParams }) {
  await requireStaffPage("links.manage");
  const sp = await searchParams;
  const tab = TABS.includes(q(sp.tab)) ? q(sp.tab) : "active";
  const search = q(sp.q).trim().slice(0, 40);
  const { page, pageSize, skip, take } = pageParams(sp);
  const today = todayIST();
  const t = dateOnlyToDate(today);
  const in30 = dateOnlyToDate(addDays(today, 30));

  const searchWhere = search
    ? { OR: [{ site: { code: { contains: search.toUpperCase() } } }, { partner: { code: { contains: search.toUpperCase() } } }, { partner: { user: { name: { contains: search } } } }] }
    : {};
  const linkWhere = {
    active: { activeSlot: { not: null }, endDate: { gt: t }, OR: [{ endedOn: null }, { endedOn: { gt: t } }] },
    expiring: { activeSlot: { not: null }, endedOn: null, endDate: { gt: t, lte: in30 } },
    ended: { OR: [{ activeSlot: null }, { endDate: { lte: t } }] },
    all: {},
  };
  const [pendingCount, expiringCount] = await Promise.all([
    prisma.siteLinkRequest.count({ where: { status: "PENDING" } }),
    prisma.siteLink.count({ where: linkWhere.expiring }),
  ]);

  let content;
  let total = 0;
  if (tab === "requests") {
    const where = { status: "PENDING" };
    const [reqs, n] = await Promise.all([
      prisma.siteLinkRequest.findMany({ where, orderBy: { id: "asc" }, skip, take, include: { partner: { include: { user: { select: { name: true, mobile: true } } } } } }),
      prisma.siteLinkRequest.count({ where }),
    ]);
    total = n;
    content =
      reqs.length === 0 ? (
        <EmptyState icon={Inbox} title="No pending requests" text="Requests that partners send from the app appear here." />
      ) : (
        <Table head={["Requested", "Partner", "Type", "Site details", ""]} minWidth={820}>
          {reqs.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{fmtDateTime(r.createdAt)}</td>
              <td className={td}><Link href={`/admin/partners/${r.partnerId}`} className="whitespace-nowrap font-medium text-navy-800 hover:underline">{r.partner.code}</Link><p className="text-xs text-slate-500">{r.partner.user.name} · {tradeName(r.partner.trade)}</p></td>
              <td className={td}><Badge tone={r.type === "NEW_SITE" ? "PENDING" : "REQUESTED"}>{r.type === "NEW_SITE" ? "New site" : "Existing site"}</Badge></td>
              <td className={`${td} text-slate-700`}>
                {r.type === "EXISTING_SITE" ? (
                  <Link href={`/admin/sites/${r.siteId}`} className="font-medium text-navy-800 hover:underline">{r.siteCode}</Link>
                ) : (
                  <>
                    <p className="font-medium text-navy-900">{r.ownerName} · {r.phone}</p>
                    <p className="text-xs text-slate-500">{r.colony}{r.mapsUrl && <> · <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="underline">map</a></>}</p>
                  </>
                )}
              </td>
              <td className={td}><LinkRequestActions req={{ id: r.id, type: r.type, partnerCode: r.partner.code, siteCode: r.siteCode }} /></td>
            </tr>
          ))}
        </Table>
      );
  } else {
    const where = { ...linkWhere[tab], ...searchWhere };
    const [links, n] = await Promise.all([
      prisma.siteLink.findMany({
        where,
        orderBy: tab === "expiring" ? { endDate: "asc" } : { id: "desc" },
        skip,
        take,
        include: { site: { select: { id: true, code: true, colony: true } }, partner: { include: { user: { select: { name: true } } } } },
      }),
      prisma.siteLink.count({ where }),
    ]);
    total = n;
    content =
      links.length === 0 ? (
        <EmptyState icon={Link2} title="No links here" text={tab === "expiring" ? "No links end in the next 30 days." : undefined} />
      ) : (
        <Table head={["Site", "Trade", "Partner", "From", "Until", "Status", ""]} minWidth={900}>
          {links.map((l) => {
            const end = (l.endedOn ?? l.endDate).toISOString().slice(0, 10);
            const active = Boolean(l.activeSlot) && end > today;
            return (
              <tr key={l.id}>
                <td className={td}><Link href={`/admin/sites/${l.site.id}`} className="font-semibold text-navy-800 hover:underline">{l.site.code}</Link><p className="text-xs text-slate-500">{l.site.colony}</p></td>
                <td className={td}>{tradeName(l.trade)}</td>
                <td className={td}><Link href={`/admin/partners/${l.partnerId}`} className="whitespace-nowrap font-medium text-navy-800 hover:underline">{l.partner.code}</Link><p className="text-xs text-slate-500">{l.partner.user.name}</p></td>
                <td className={`${td} whitespace-nowrap`}>{fmtDay(l.startDate)}</td>
                <td className={`${td} whitespace-nowrap ${tab === "expiring" ? "font-semibold text-amber-700" : ""}`}>{fmtDay(end)}</td>
                <td className={td}>{active ? <Badge tone="ACTIVE">Active</Badge> : <StatusBadge status={l.status === "ACTIVE" ? "EXPIRED" : l.status} />}{l.endReason && <p className="mt-1 max-w-[14rem] text-xs text-slate-500">{l.endReason}</p>}</td>
                <td className={td}><LinkRowActions link={{ id: l.id, active, trade: l.trade, tradeLabel: tradeName(l.trade), siteCode: l.site.code, partnerCode: l.partner.code, endDateLabel: fmtDay(l.endDate) }} /></td>
              </tr>
            );
          })}
        </Table>
      );
  }

  return (
    <>
      <PageHeader title="Partner–site links" subtitle="Only the Store Manager or Owner can create, end or change a link. Every change is logged with a reason." action={<CreateLinkButton />} />
      <LinkTabs
        basePath="/admin/links"
        active={tab}
        params={search ? { q: search } : {}}
        tabs={[
          { key: "active", label: "Active" },
          { key: "expiring", label: "Ending in 30 days", count: expiringCount },
          { key: "requests", label: "Requests", count: pendingCount },
          { key: "ended", label: "Ended / expired" },
          { key: "all", label: "All history" },
        ]}
      />
      {tab !== "requests" && (
        <form method="get" className="mb-4 flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={search} placeholder="Site code, partner code or name" className={`${inputClass} max-w-sm`} aria-label="Search links" />
          <button className="rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Search</button>
        </form>
      )}
      <Card className="overflow-hidden">
        {content}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/links" params={{ tab, ...(search ? { q: search } : {}) }} />
      </Card>
    </>
  );
}
