import Link from "next/link";
import { Gift } from "lucide-react";
import { Card, PageHeader, StatusBadge, Table, td, Pagination, EmptyState, pageParams, LinkTabs, formatPts } from "@/components/ui";
import RedemptionActions from "@/components/admin/RedemptionActions";
import { prisma, repo } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDateTime, q } from "@/lib/server/format";
import { summarizeLots } from "@/lib/loyalty/balance";

export const metadata = { title: "Redemptions · UNIBUILD Admin" };

const TABS = ["REQUESTED", "APPROVED", "READY", "COLLECTED", "REJECTED", "ALL"];

export default async function RedemptionsAdmin({ searchParams }) {
  await requireStaffPage("redemptions.manage");
  const sp = await searchParams;
  const tab = TABS.includes(q(sp.tab)) ? q(sp.tab) : "REQUESTED";
  const { page, pageSize, skip, take } = pageParams(sp);
  const where = tab === "ALL" ? {} : { status: tab };
  const [rows, total, counts] = await Promise.all([
    prisma.redemption.findMany({ where, orderBy: { id: tab === "REQUESTED" ? "asc" : "desc" }, skip, take, include: { partner: { include: { user: { select: { name: true, mobile: true } } } } } }),
    prisma.redemption.count({ where }),
    prisma.redemption.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const balances = new Map();
  for (const pid of [...new Set(rows.map((r) => r.partnerId))]) {
    balances.set(pid, summarizeLots(await repo.findPartnerLots(pid, { withRemaining: true })).available);
  }

  return (
    <>
      <PageHeader title="Redemptions" subtitle="Points are taken when the partner requests a reward; rejecting returns them. Rewards are collected at the counter." />
      <LinkTabs
        basePath="/admin/redemptions"
        active={tab}
        tabs={[
          { key: "REQUESTED", label: "New requests", count: count.REQUESTED ?? 0 },
          { key: "APPROVED", label: "Approved", count: count.APPROVED ?? 0 },
          { key: "READY", label: "Ready for pickup", count: count.READY ?? 0 },
          { key: "COLLECTED", label: "Collected" },
          { key: "REJECTED", label: "Rejected" },
          { key: "ALL", label: "All" },
        ]}
      />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Gift} title="No redemptions here" />
        ) : (
          <Table head={["Ref", "Partner", "Reward", { label: "Points", right: true }, { label: "Available now", right: true }, "Requested", "Status", ""]} minWidth={960}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} font-semibold text-navy-900`}>{r.number}</td>
                <td className={td}><Link href={`/admin/partners/${r.partnerId}`} className="whitespace-nowrap font-medium text-navy-800 hover:underline">{r.partner.code}</Link><p className="text-xs text-slate-500">{r.partner.user.name} · {r.partner.user.mobile}</p></td>
                <td className={td}>{r.rewardName}{r.notes && <p className="text-xs text-slate-500">“{r.notes}”</p>}</td>
                <td className={`${td} text-right font-semibold`}>{formatPts(r.points)}</td>
                <td className={`${td} text-right text-slate-600`}>{formatPts(balances.get(r.partnerId) ?? 0)}</td>
                <td className={`${td} whitespace-nowrap text-slate-600`}>{fmtDateTime(r.requestedAt)}</td>
                <td className={td}><StatusBadge status={r.status} />{r.rejectionReason && <p className="mt-1 max-w-[12rem] text-xs text-rose-600">{r.rejectionReason}</p>}</td>
                <td className={td}><RedemptionActions r={{ id: r.id, number: r.number, status: r.status, points: r.points, rewardName: r.rewardName, partnerCode: r.partner.code }} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/redemptions" params={{ tab }} />
      </Card>
    </>
  );
}
