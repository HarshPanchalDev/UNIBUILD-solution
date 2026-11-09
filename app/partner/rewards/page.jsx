import Link from "next/link";
import { Gift } from "lucide-react";
import { Card, PageHeader, EmptyState, formatPts } from "@/components/ui";
import RedeemButton from "@/components/partner/RedeemButton";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { loadSummary, loadRewards } from "@/lib/server/partnerData";
import { fileUrl } from "@/lib/server/storage";
import { q } from "@/lib/server/format";

export default async function RewardsPage({ searchParams }) {
  const s = await requirePartnerPage();
  const { t } = await getT();
  const sp = await searchParams;
  const [sum, rewards] = await Promise.all([loadSummary(s.partner.id), loadRewards()]);
  const groups = [...new Set(rewards.map((r) => r.section))];
  const group = groups.includes(q(sp.group)) ? q(sp.group) : "";
  const list = group ? rewards.filter((r) => r.section === group) : rewards;
  const active = s.partner.status === "APPROVED";

  return (
    <>
      <PageHeader
        title={t("rewardsPage.title")}
        subtitle={t("rewardsPage.subtitle")}
        action={
          <div className="rounded-xl bg-navy-50 px-4 py-2 text-right">
            <p className="text-xs text-slate-500">{t("rewardsPage.available")}</p>
            <p className="font-display text-xl font-bold text-navy-900">{formatPts(sum.available)}</p>
          </div>
        }
      />
      {groups.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[["", t("rewardsPage.all")], ...groups.map((g) => [g, g])].map(([g, label]) => (
            <Link key={g || "all"} href={g ? `/partner/rewards?group=${encodeURIComponent(g)}` : "/partner/rewards"} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${group === g ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {label}
            </Link>
          ))}
        </div>
      )}
      {!active && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{t("rewardsPage.blocked")}</p>}
      {list.length === 0 ? (
        <Card><EmptyState icon={Gift} title={t("rewardsPage.empty")} /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {list.map((r) => {
            const can = active && sum.available >= sum.minRedeem && sum.available >= r.points;
            return (
              <Card key={r.id} className="flex flex-col p-3 sm:p-4">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-brand-50">
                  {r.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(r.imageKey)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Gift className="h-12 w-12 text-brand-600" />
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold text-navy-900 sm:text-base">{r.name}</p>
                {r.description && <p className="line-clamp-2 text-xs text-slate-500">{r.description}</p>}
                <p className="mt-1 text-sm font-medium text-navy-700">{formatPts(r.points)} {t("common.pts")}</p>
                <div className="mt-auto pt-3">
                  <RedeemButton reward={{ id: r.id, name: r.name, points: r.points }} canRedeem={can} shortBy={Math.max(r.points, sum.minRedeem) - sum.available} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">{t("rewardsPage.minNote", { min: sum.minRedeem })}</p>
    </>
  );
}
