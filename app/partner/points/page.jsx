import { Star } from "lucide-react";
import { Badge, Card, PageHeader, EmptyState, formatPts, inputClass } from "@/components/ui";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { loadSummary, loadHistory } from "@/lib/server/partnerData";
import { formatDisplayDate } from "@/lib/loyalty/dates";
import { q } from "@/lib/server/format";

const STATES = ["LOCKED", "AVAILABLE", "REDEEMED", "REVERSED", "EXPIRED"];

export default async function PointsPage({ searchParams }) {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  const sp = await searchParams;
  const [sum, all] = await Promise.all([loadSummary(s.partner.id), loadHistory(s.partner.id)]);
  const month = q(sp.month);
  const site = q(sp.site);
  const category = q(sp.category);
  const state = STATES.includes(q(sp.state)) ? q(sp.state) : "";
  const monthOf = (iso) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 7);
  const months = [...new Set(all.map((h) => monthOf(h.date)))];
  const sites = [...new Map(all.filter((h) => h.site).map((h) => [h.site.code, h.site])).values()];
  const rows = all.filter((h) => (!month || monthOf(h.date) === month) && (!site || h.site?.code === site) && (!category || String(h.category) === category) && (!state || h.state === state));
  const reversed = all.filter((h) => h.type === "REVERSAL").reduce((a, h) => a - h.points, 0);
  const redeemed = all.filter((h) => h.type === "REDEMPTION").reduce((a, h) => a - h.points, 0) - all.filter((h) => h.type === "REDEMPTION_REFUND").reduce((a, h) => a + h.points, 0);

  const label = (h) => {
    if (h.site) return `${h.site.code} · ${h.site.name}`;
    return { REDEMPTION: t("pointsPage.redemption"), REDEMPTION_REFUND: t("pointsPage.refund"), EXPIRY: t("pointsPage.expiry"), ADJUSTMENT: t("pointsPage.adjustment"), REVERSAL: t("pointsPage.reversal") }[h.type] ?? h.type;
  };
  const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title={t("pointsPage.title")} subtitle={t("pointsPage.subtitle")} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("state.AVAILABLE"), sum.available, "text-emerald-600"],
          [t("state.LOCKED"), sum.locked, "text-amber-600"],
          [t("state.REDEEMED"), Math.max(0, redeemed), "text-navy-700"],
          [t("state.REVERSED"), reversed, "text-rose-600"],
        ].map(([l, v, c]) => (
          <Card key={l} className="p-4">
            <p className={`font-display text-2xl font-bold ${c}`}>{formatPts(v)}</p>
            <p className="text-sm text-slate-500">{l}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4 sm:p-5">
        <form method="get" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select name="month" defaultValue={month} className={inputClass} aria-label={t("pointsPage.allMonths")}>
            <option value="">{t("pointsPage.allMonths")}</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select name="site" defaultValue={site} className={inputClass} aria-label={t("pointsPage.allSites")}>
            <option value="">{t("pointsPage.allSites")}</option>
            {sites.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}
          </select>
          <select name="category" defaultValue={category} className={inputClass} aria-label={t("pointsPage.allCategories")}>
            <option value="">{t("pointsPage.allCategories")}</option>
            {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select>
          <select name="state" defaultValue={state} className={inputClass} aria-label={t("pointsPage.allStates")}>
            <option value="">{t("pointsPage.allStates")}</option>
            {STATES.map((x) => <option key={x} value={x}>{t(`state.${x}`)}</option>)}
          </select>
          <button className="col-span-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-1">{t("common.apply")}</button>
        </form>

        {rows.length === 0 ? (
          <EmptyState icon={Star} title={all.length ? t("pointsPage.empty") : t("home.noActivity")} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-900">{label(h)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDisplayDate(h.date, lang)}
                    {h.category ? ` · ${t(`category.${h.category}`)}` : ""}
                    {h.unlockAt ? ` · ${t("pointsPage.unlockOn", { date: formatDisplayDate(h.unlockAt, lang) })}` : ""}
                  </p>
                  {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`font-semibold ${h.points < 0 ? "text-rose-600" : "text-navy-900"}`}>{h.points > 0 ? "+" : ""}{formatPts(h.points)}</span>
                  <Badge tone={h.state}>{t(`state.${h.state}`)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
