import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MapPin, ExternalLink } from "lucide-react";
import { Card, PageHeader, StatusBadge, Table, td, Badge } from "@/components/ui";
import SiteForm from "@/components/admin/SiteForm";
import { SiteStatusButton, MergeSitesButton } from "@/components/admin/SiteTools";
import { CreateLinkButton, LinkRowActions } from "@/components/admin/LinkTools";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDate, fmtDay, fmtDateTime, fmtNum, fmtMoney, tradeName, catName } from "@/lib/server/format";
import { todayIST } from "@/lib/loyalty/dates";

export default async function SiteDetail({ params }) {
  await requireStaffPage("sites.manage");
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id: Number(id) || 0 },
    include: {
      phones: true,
      aliases: true,
      mergedInto: { select: { id: true, code: true } },
      submittedByPartner: { select: { code: true } },
      links: { orderBy: { startDate: "desc" }, include: { partner: { include: { user: { select: { name: true } } } } } },
    },
  });
  if (!site) notFound();
  const [lines, pointsBySite, history] = await Promise.all([
    prisma.invoiceLine.findMany({ where: { siteId: site.id }, orderBy: { id: "desc" }, take: 30, include: { invoice: { select: { number: true, invoiceDate: true, paymentDate: true } } } }),
    prisma.pointLot.aggregate({ where: { siteId: site.id }, _sum: { points: true, reversedPoints: true } }),
    prisma.auditLog.findMany({ where: { entityType: "Site", entityId: String(site.id) }, orderBy: { id: "desc" }, take: 20, include: { user: { select: { name: true } } } }),
  ]);
  const today = todayIST();
  const linkRows = site.links.map((l) => {
    const end = (l.endedOn ?? l.endDate).toISOString().slice(0, 10);
    const active = Boolean(l.activeSlot) && end > today;
    return { l, active, end };
  });

  return (
    <>
      <Link href="/admin/sites" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-600 hover:underline"><ArrowLeft className="h-4 w-4" /> All sites</Link>
      <PageHeader
        title={site.code}
        subtitle={site.displayName ? `${site.displayName} · ${site.colony}` : site.colony}
        action={
          site.status === "MERGED" ? (
            <Link href={`/admin/sites/${site.mergedInto?.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Merged into {site.mergedInto?.code} →</Link>
          ) : (
            <>
              <SiteStatusButton siteId={site.id} status={site.status} />
              <MergeSitesButton defaultCode={site.code} />
              <SiteForm site={{ id: site.id, code: site.code, displayName: site.displayName ?? "", ownerName: site.ownerName, phones: site.phones.map((p) => p.phone), colony: site.colony, address: site.address ?? "", mapsUrl: site.mapsUrl ?? "" }} />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><StatusBadge status={site.status} /></div>
            {site.isIncomplete && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Created at the counter or from a request — please complete the details.</p>}
            <div><p className="text-slate-500">Owner</p><p className="font-medium text-navy-900">{site.ownerName}</p></div>
            <div>
              <p className="text-slate-500">Phones</p>
              {site.phones.map((p) => <p key={p.id} className="flex items-center gap-1.5 font-medium text-navy-900"><Phone className="h-3.5 w-3.5 text-slate-400" /> {p.phone}</p>)}
            </div>
            <div><p className="text-slate-500">Colony / address</p><p className="font-medium text-navy-900">{site.colony}{site.address ? `, ${site.address}` : ""}</p></div>
            {site.mapsUrl && <a href={site.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-navy-600 hover:underline"><MapPin className="h-4 w-4" /> Open in Maps <ExternalLink className="h-3 w-3" /></a>}
            <div><p className="text-slate-500">Created</p><p className="text-navy-900">{fmtDateTime(site.createdAt)} · {site.source.replace(/_/g, " ").toLowerCase()}{site.submittedByPartner ? ` by ${site.submittedByPartner.code}` : ""}</p></div>
            {site.aliases.length > 0 && <div><p className="text-slate-500">Also resolves</p><p className="font-medium text-navy-900">{site.aliases.map((a) => a.alias).join(", ")}</p></div>}
          </Card>
          <Card className="p-5 text-sm">
            <p className="text-slate-500">Points earned on this site</p>
            <p className="font-display text-2xl font-bold text-navy-900">{fmtNum(pointsBySite._sum.points ?? 0)}</p>
            {(pointsBySite._sum.reversedPoints ?? 0) > 0 && <p className="text-xs text-rose-600">{fmtNum(pointsBySite._sum.reversedPoints)} reversed for returns</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
              <p className="font-semibold text-navy-900">Partner links</p>
              {site.status !== "MERGED" && <CreateLinkButton site={{ id: site.id, code: site.code, ownerName: site.ownerName }} />}
            </div>
            <p className="px-5 text-xs text-slate-500">At most one active link per trade (contractor, plumber, electrician, painter).</p>
            <div className="mt-3">
              {linkRows.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-slate-500">No partner linked yet — purchases on this site earn no points.</p>
              ) : (
                <Table head={["Trade", "Partner", "From", "Until", "Status", ""]} minWidth={680}>
                  {linkRows.map(({ l, active, end }) => (
                    <tr key={l.id}>
                      <td className={td}>{tradeName(l.trade)}</td>
                      <td className={td}><Link href={`/admin/partners/${l.partnerId}`} className="whitespace-nowrap font-medium text-navy-800 hover:underline">{l.partner.code}</Link><p className="text-xs text-slate-500">{l.partner.user.name}</p></td>
                      <td className={`${td} whitespace-nowrap`}>{fmtDay(l.startDate)}</td>
                      <td className={`${td} whitespace-nowrap`}>{fmtDay(end)}</td>
                      <td className={td}>{active ? <Badge tone="ACTIVE">Active</Badge> : <StatusBadge status={l.status === "ACTIVE" ? "EXPIRED" : l.status} />}{l.endReason && <p className="mt-1 text-xs text-slate-500">{l.endReason}</p>}</td>
                      <td className={td}><LinkRowActions link={{ id: l.id, active, trade: l.trade, tradeLabel: tradeName(l.trade), siteCode: site.code, partnerCode: l.partner.code, endDateLabel: fmtDay(l.endDate) }} /></td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <p className="px-5 pt-5 font-semibold text-navy-900">Recent invoice lines</p>
            <div className="mt-3">
              {lines.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-slate-500">No paid invoices for this site yet.</p>
              ) : (
                <Table head={["Invoice", "Invoice date", "Item", "Category", { label: "Qty", right: true }, { label: "Taxable", right: true }, "Status"]} minWidth={760}>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className={`${td} font-medium`}>{l.invoice.number}</td>
                      <td className={`${td} whitespace-nowrap`}>{fmtDay(l.invoice.invoiceDate)}</td>
                      <td className={td}>{l.itemName}</td>
                      <td className={td}>{catName(l.category)}</td>
                      <td className={`${td} text-right`}>{Number(l.quantity)} {l.unit}</td>
                      <td className={`${td} text-right`}>{fmtMoney(l.taxableValue)}</td>
                      <td className={td}><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-2 font-semibold text-navy-900">History</p>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No changes recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium text-navy-900">{h.action.replace(/_/g, " ").toLowerCase()}</span> · {h.user?.name ?? "System"} · <span className="text-slate-500">{fmtDateTime(h.createdAt)}</span>
                    {h.reason && <p className="text-xs text-slate-500">{h.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">Created {fmtDate(site.createdAt)}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
