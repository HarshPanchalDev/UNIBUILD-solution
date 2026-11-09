import Link from "next/link";
import { FileCheck2, Star, AlertTriangle, Users, UserCheck, MapPin, Link2, Gift, Upload, ChevronRight, Clock } from "lucide-react";
import { Badge, Card, StatCard, StatusBadge, EmptyState } from "@/components/ui";
import LineChart from "@/components/LineChart";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtNum, fmtDateTime, istBoundaries } from "@/lib/server/format";

export default async function AdminDashboard({ searchParams }) {
  const s = await requireStaffPage();
  const sp = await searchParams;
  const { startOfToday, startOfMonth } = istBoundaries();
  const since30 = new Date(Date.now() - 30 * 86400000);
  const since14 = new Date(startOfToday.getTime() - 13 * 86400000);

  const [todayUploads, partnersTotal, pending, approved, active, sites, exceptions, linkRequests, redemptions, monthPoints, credits14, activity, expiring] = await Promise.all([
    prisma.uploadBatch.findMany({ where: { createdAt: { gte: startOfToday } }, orderBy: { id: "desc" } }),
    prisma.partner.count(),
    prisma.partner.count({ where: { status: "PENDING" } }),
    prisma.partner.count({ where: { status: "APPROVED" } }),
    prisma.ledgerEntry.groupBy({ by: ["partnerId"], where: { type: "CREDIT", createdAt: { gte: since30 } } }),
    prisma.site.count({ where: { status: { not: "MERGED" } } }),
    prisma.uploadException.count({ where: { status: "OPEN" } }),
    prisma.siteLinkRequest.count({ where: { status: "PENDING" } }),
    prisma.redemption.count({ where: { status: { in: ["REQUESTED", "APPROVED", "READY"] } } }),
    prisma.ledgerEntry.aggregate({ where: { type: "CREDIT", createdAt: { gte: startOfMonth } }, _sum: { points: true } }),
    prisma.ledgerEntry.findMany({ where: { type: "CREDIT", createdAt: { gte: since14 } }, select: { points: true, createdAt: true } }),
    prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 8, include: { user: { select: { name: true } } } }),
    prisma.siteLink.count({ where: { activeSlot: { not: null }, endedOn: null, endDate: { lte: new Date(Date.now() + 30 * 86400000) } } }),
  ]);

  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * 86400000);
    const key = new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
    days.push({ key, label: new Date(key).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }), value: 0 });
  }
  for (const c of credits14) {
    const key = new Date(c.createdAt.getTime() + 330 * 60000).toISOString().slice(0, 10);
    const d = days.find((x) => x.key === key);
    if (d) d.value += c.points;
  }
  const invoiceToday = todayUploads.find((u) => u.kind === "INVOICE" && u.status === "PROCESSED");
  const creditToday = todayUploads.find((u) => u.kind === "CREDIT_NOTE" && u.status === "PROCESSED");

  return (
    <div className="space-y-6">
      {sp?.denied && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">That page is for the Owner only.</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Hello {s.user.name.split(" ")[0]} — here is today at the store.</p>
        </div>
        <Link href="/admin/uploads" className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
          <Upload className="h-4 w-4" /> Upload BUSY file
        </Link>
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 ${invoiceToday ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            {invoiceToday ? <FileCheck2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <div>
            <p className="font-semibold text-navy-900">Today&apos;s upload</p>
            <p className="text-sm text-slate-500">
              {invoiceToday ? `Paid invoices uploaded at ${fmtDateTime(invoiceToday.createdAt).split(", ").pop()} · ${fmtNum(invoiceToday.pointsCredited)} points credited` : "Paid-invoice file not uploaded yet today"}
              {" · "}
              {creditToday ? "credit notes uploaded" : "credit notes not uploaded"}
            </p>
          </div>
        </div>
        {!invoiceToday && <Badge tone="PENDING">Pending</Badge>}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} iconClass="text-navy-600" value={fmtNum(partnersTotal)} label="Registered partners" hint={`${fmtNum(approved)} approved`} href="/admin/partners" />
        <StatCard icon={UserCheck} iconClass="text-amber-500" value={fmtNum(pending)} label="Pending approvals" href="/admin/partners?tab=PENDING" />
        <StatCard icon={Star} iconClass="fill-brand-500 text-brand-500" value={fmtNum(active.length)} label="Active partners" hint="Credited in the last 30 days" />
        <StatCard icon={MapPin} iconClass="text-navy-600" value={fmtNum(sites)} label="Registered sites" href="/admin/sites" />
        <StatCard icon={AlertTriangle} iconClass="text-rose-500" value={fmtNum(exceptions)} label="Open exceptions" href="/admin/exceptions" />
        <StatCard icon={Link2} iconClass="text-sky-600" value={fmtNum(linkRequests)} label="Site-link requests" hint={`${fmtNum(expiring)} links end within 30 days`} href="/admin/links?tab=requests" />
        <StatCard icon={Gift} iconClass="text-orange-500" value={fmtNum(redemptions)} label="Open redemptions" href="/admin/redemptions" />
        <StatCard icon={Star} iconClass="text-emerald-600" value={fmtNum(monthPoints._sum.points ?? 0)} label="Points credited this month" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-navy-900">Points credited — last 14 days</p>
            <span className="text-xs text-slate-500">{fmtNum(days.reduce((a, d) => a + d.value, 0))} pts</span>
          </div>
          {days.some((d) => d.value > 0) ? (
            <LineChart data={days} label="Points credited in the last 14 days" />
          ) : (
            <EmptyState icon={Star} title="No points credited yet" text="Upload the daily paid-invoice file from BUSY to credit points." />
          )}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-navy-900">Recent activity</p>
            {s.user.role === "OWNER" && (
              <Link href="/admin/audit-log" className="flex items-center text-sm font-medium text-navy-600">
                Audit log <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((a) => (
                <li key={a.id} className="py-2.5">
                  <p className="text-sm text-navy-900">
                    <span className="font-medium">{a.user?.name ?? "System"}</span> · {a.action.replace(/_/g, " ").toLowerCase()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.entityType} {a.entityId ? `#${a.entityId}` : ""} · {fmtDateTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {todayUploads.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 font-semibold text-navy-900">Today&apos;s files</p>
          <ul className="divide-y divide-slate-100">
            {todayUploads.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/uploads/${u.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-navy-600">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.fileName}</span>
                    <span className="text-xs text-slate-500">{u.kind === "INVOICE" ? "Paid invoices" : "Credit notes"} · {fmtNum(u.linesRead)} lines · {u.linesException} exceptions</span>
                  </span>
                  <StatusBadge status={u.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
