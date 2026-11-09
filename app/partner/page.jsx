import Link from "next/link";
import { Star, Gift, BadgeCheck, Bell, Home, Lock, ChevronRight, TrendingUp, AlertCircle, Undo2 } from "lucide-react";
import { Badge, Card, formatPts } from "@/components/ui";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { loadSummary, loadHistory, loadNotices } from "@/lib/server/partnerData";
import { formatDisplayDate } from "@/lib/loyalty/dates";

export default async function PartnerHome() {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  const [sum, history, notices] = await Promise.all([loadSummary(s.partner.id), loadHistory(s.partner.id), loadNotices(s.user.id, lang, 3)]);
  const recent = history.slice(0, 5);
  const firstName = s.user.name.split(" ")[0];

  const tierBlock = (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-navy-600" />
          <p className="font-semibold text-navy-900">{sum.nextTier ? t("home.tierProgress", { tier: t(`tier.${sum.nextTier}`) }) : t("home.tierTop")}</p>
        </div>
        {sum.tierProgress !== null && <span className="text-sm font-semibold text-navy-700">{sum.tierProgress}%</span>}
      </div>
      {sum.nextTier && sum.tierProgress !== null && (
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${sum.tierProgress}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {t("home.multiplier", { m: sum.multiplier })}
        {sum.nextTier && sum.tierProgress === null ? ` · ${t("home.tierNotSet")}` : ""}
      </p>
    </Card>
  );

  const lockedBlock = (
    <Card className="flex items-center gap-4 p-5">
      <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Lock className="h-6 w-6" /></div>
      <div>
        <p className="font-semibold text-navy-900">{formatPts(sum.locked)} {t("common.pts")} · {t("home.locked")}</p>
        <p className="text-sm text-slate-500">{sum.nextUnlock ? t("home.unlocks", { points: formatPts(sum.nextUnlock.points), date: formatDisplayDate(sum.nextUnlock.date, lang) }) : t("home.noLocked")}</p>
      </div>
    </Card>
  );

  const activity = (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-navy-900">{t("home.recent")}</p>
        <Link href="/partner/points" className="flex items-center text-sm font-medium text-navy-600">{t("common.viewAll")} <ChevronRight className="h-4 w-4" /></Link>
      </div>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t("home.noActivity")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`rounded-lg p-2 ${r.points < 0 ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600"}`}>{r.points < 0 ? <Undo2 className="h-4 w-4" /> : <Gift className="h-4 w-4" />}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-900">{r.site ? `${r.site.code} · ${r.site.name}` : r.type === "REDEMPTION" ? t("pointsPage.redemption") : r.type === "ADJUSTMENT" ? t("pointsPage.adjustment") : t(`state.${r.state}`)}</p>
                  <p className="text-xs text-slate-500">{formatDisplayDate(r.date, lang)}{r.category ? ` · ${t(`category.${r.category}`)}` : ""}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`font-semibold ${r.points < 0 ? "text-rose-600" : "text-emerald-600"}`}>{r.points > 0 ? "+" : ""}{formatPts(r.points)}</span>
                <Badge tone={r.state}>{t(`state.${r.state}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const noticesBlock = (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-navy-900">{t("home.latestNotices")}</p>
        <Link href="/partner/notices" className="text-sm font-medium text-navy-600">{t("common.viewAll")}</Link>
      </div>
      {notices.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">{t("home.noNotices")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {notices.map((n) => (
            <li key={n.id} className="flex gap-3 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-200" : "bg-brand-500"}`} />
              <div>
                <p className="text-sm font-medium text-navy-900">{n.title}</p>
                <p className="text-xs text-slate-500">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 lg:text-2xl">{t("home.hello", { name: firstName })}</h1>
          <p className="text-sm text-slate-500">{t("home.code")}: <span className="font-semibold text-navy-800">{sum.code}</span></p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-navy-800">
          <BadgeCheck className="h-4 w-4" /> {t(`tier.${sum.tier}`)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-brand-400 p-5 lg:col-span-1">
          <div className="flex items-center gap-3">
            <Star className="h-9 w-9 fill-brand-600 text-brand-600" />
            <div>
              <p className="text-xs font-medium text-navy-900/80">{t("home.available")}</p>
              <p className="font-display text-3xl font-bold text-navy-900">{formatPts(sum.available)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-navy-900/70">{t("home.yourPoints")}: {formatPts(sum.total)} ({t("home.locked")} {formatPts(sum.locked)})</p>
        </div>
        <div className="lg:col-span-1">{lockedBlock}</div>
        <div className="lg:col-span-1">{tierBlock}</div>
      </div>

      {sum.expiringSoon > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200"><AlertCircle className="h-4 w-4 shrink-0" /> {t("home.expiring", { points: formatPts(sum.expiringSoon) })}</p>
      )}

      <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:hidden">
        {[
          ["/partner/points", Star, t("nav.pointsShort")],
          ["/partner/sites", Home, t("nav.sitesShort")],
          ["/partner/rewards", Gift, t("nav.rewards")],
          ["/partner/notices", Bell, t("nav.notices")],
        ].map(([href, Icon, label]) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-4 text-center shadow-sm active:bg-slate-50">
            <Icon className="h-6 w-6 fill-navy-800 text-navy-800" />
            <span className="text-xs font-medium text-navy-900">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">{activity}</div>
        {noticesBlock}
      </div>
    </div>
  );
}
