import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader, StatusBadge, Table, td, Badge, formatPts } from "@/components/ui";
import PartnerActions from "@/components/admin/PartnerActions";
import { prisma, repo } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDate, fmtDay, fmtDateTime, tradeName, tierName, catName } from "@/lib/server/format";
import { summarizeLots, lotState } from "@/lib/loyalty/balance";
import { fileUrl } from "@/lib/server/storage";
import { todayIST } from "@/lib/loyalty/dates";

export default async function PartnerDetail({ params }) {
  const s = await requireStaffPage("partners.manage");
  const { id } = await params;
  const partner = await prisma.partner.findUnique({
    where: { id: Number(id) || 0 },
    include: {
      user: true,
      links: { orderBy: { startDate: "desc" }, include: { site: { select: { id: true, code: true, colony: true } } } },
      redemptions: { orderBy: { id: "desc" }, take: 10 },
      tierHistory: { orderBy: { id: "desc" }, take: 10 },
      shortfalls: { where: { status: "OPEN" } },
    },
  });
  if (!partner) notFound();
  const [lots, ledger] = await Promise.all([
    repo.findPartnerLots(partner.id),
    prisma.ledgerEntry.findMany({ where: { partnerId: partner.id }, orderBy: { id: "desc" }, take: 50 }),
  ]);
  const now = new Date();
  const bal = summarizeLots(lots, now);
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const siteIds = [...new Set(ledger.map((e) => e.siteId).filter(Boolean))];
  const sites = new Map((await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, code: true } })).map((x) => [x.id, x.code]));
  const today = todayIST();

  return (
    <>
      <Link href="/admin/partners" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-600 hover:underline"><ArrowLeft className="h-4 w-4" /> All partners</Link>
      <PageHeader
        title={partner.user.name}
        subtitle={`${partner.code ?? "No code yet"} · ${tradeName(partner.trade)} · ${partner.areaServed}`}
        action={<PartnerActions isOwner={s.user.role === "OWNER"} partner={{ id: partner.id, name: partner.user.name, code: partner.code, trade: partner.trade, status: partner.status, tier: partner.tier }} />}
      />
      {partner.statusReason && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Status note: {partner.statusReason}</p>}
      {partner.shortfalls.length > 0 && (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {partner.shortfalls.reduce((a, x) => a + x.points - x.recoveredPoints, 0)} points from returns could not be reversed (policy: {partner.shortfalls[0].policy}). Owner decision pending (open question Q3).
          {partner.pendingDeduction > 0 && ` ${partner.pendingDeduction} will be recovered from future points.`}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <Card className="flex flex-col items-center p-6 text-center">
            {partner.photoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(partner.photoKey)} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500 font-display text-2xl font-bold text-navy-900">{partner.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
            )}
            <div className="mt-3 flex gap-2"><StatusBadge status={partner.status} /><Badge tone={partner.tier}>{tierName(partner.tier)}</Badge></div>
            <dl className="mt-4 w-full space-y-2 text-left text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Mobile</dt><dd className="font-medium">{partner.user.mobile}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Registered</dt><dd>{fmtDate(partner.createdAt)}</dd></div>
              {partner.approvedAt && <div className="flex justify-between"><dt className="text-slate-500">Approved</dt><dd>{fmtDate(partner.approvedAt)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">WhatsApp/SMS notices</dt><dd>{partner.whatsappOptIn ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Last sign-in</dt><dd>{partner.user.lastLoginAt ? fmtDate(partner.user.lastLoginAt) : "—"}</dd></div>
            </dl>
          </Card>
          <Card className="grid grid-cols-2 gap-4 p-5">
            <div><p className="font-display text-xl font-bold text-emerald-600">{formatPts(bal.available)}</p><p className="text-xs text-slate-500">Available</p></div>
            <div><p className="font-display text-xl font-bold text-amber-600">{formatPts(bal.locked)}</p><p className="text-xs text-slate-500">Locked</p></div>
            {bal.nextUnlock && <p className="col-span-2 text-xs text-slate-500">{formatPts(bal.nextUnlock.points)} unlock on {fmtDate(bal.nextUnlock.at)}</p>}
          </Card>
          {partner.tierHistory.length > 0 && (
            <Card className="p-5">
              <p className="mb-2 font-semibold text-navy-900">Tier history</p>
              <ul className="space-y-1.5 text-sm">{partner.tierHistory.map((h) => <li key={h.id}>{tierName(h.fromTier)} → <b>{tierName(h.toTier)}</b> <span className="text-xs text-slate-500">· {fmtDate(h.createdAt)} · {h.reason}</span></li>)}</ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <p className="px-5 pt-5 font-semibold text-navy-900">Linked sites</p>
            <div className="mt-3">
              {partner.links.length === 0 ? <p className="px-5 pb-6 text-sm text-slate-500">Not linked to any site.</p> : (
                <Table head={["Site", "From", "Until", "Status"]} minWidth={480}>
                  {partner.links.map((l) => {
                    const end = (l.endedOn ?? l.endDate).toISOString().slice(0, 10);
                    const active = Boolean(l.activeSlot) && end > today;
                    return (
                      <tr key={l.id}>
                        <td className={td}><Link href={`/admin/sites/${l.site.id}`} className="font-semibold text-navy-800 hover:underline">{l.site.code}</Link> <span className="text-xs text-slate-500">{l.site.colony}</span></td>
                        <td className={td}>{fmtDay(l.startDate)}</td>
                        <td className={td}>{fmtDay(end)}</td>
                        <td className={td}>{active ? <Badge tone="ACTIVE">Active</Badge> : <StatusBadge status={l.status === "ACTIVE" ? "EXPIRED" : l.status} />}</td>
                      </tr>
                    );
                  })}
                </Table>
              )}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <p className="px-5 pt-5 font-semibold text-navy-900">Points ledger <span className="text-xs font-normal text-slate-500">(latest 50 · entries are never deleted)</span></p>
            <div className="mt-3">
              {ledger.length === 0 ? <p className="px-5 pb-6 text-sm text-slate-500">No points yet.</p> : (
                <Table head={["Date", "Type", "Site", "Category", { label: "Points", right: true }, "State / note"]} minWidth={720}>
                  {ledger.map((e) => {
                    const lot = e.lotId ? lotById.get(e.lotId) : null;
                    return (
                      <tr key={e.id}>
                        <td className={`${td} whitespace-nowrap text-slate-600`}>{fmtDateTime(e.createdAt)}</td>
                        <td className={td}>{e.type.replace(/_/g, " ").toLowerCase()}</td>
                        <td className={td}>{e.siteId ? sites.get(e.siteId) : "—"}</td>
                        <td className={td}>{e.category ? catName(e.category) : "—"}</td>
                        <td className={`${td} text-right font-semibold ${e.points < 0 ? "text-rose-600" : "text-emerald-700"}`}>{e.points > 0 ? "+" : ""}{formatPts(e.points)}</td>
                        <td className={`${td} text-xs text-slate-500`}>{e.type === "CREDIT" && lot ? <StatusBadge status={lotState(lot, now)} /> : e.note}</td>
                      </tr>
                    );
                  })}
                </Table>
              )}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <p className="px-5 pt-5 font-semibold text-navy-900">Redemptions</p>
            <div className="mt-3">
              {partner.redemptions.length === 0 ? <p className="px-5 pb-6 text-sm text-slate-500">No redemptions yet.</p> : (
                <Table head={["Ref", "Reward", { label: "Points", right: true }, "Requested", "Status"]} minWidth={520}>
                  {partner.redemptions.map((r) => (
                    <tr key={r.id}><td className={`${td} font-medium`}>{r.number}</td><td className={td}>{r.rewardName}</td><td className={`${td} text-right`}>{formatPts(r.points)}</td><td className={td}>{fmtDate(r.requestedAt)}</td><td className={td}><StatusBadge status={r.status} /></td></tr>
                  ))}
                </Table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
