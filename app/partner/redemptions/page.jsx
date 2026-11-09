import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge, Card, PageHeader, EmptyState, formatPts } from "@/components/ui";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { loadRedemptions } from "@/lib/server/partnerData";
import { formatDisplayDate } from "@/lib/loyalty/dates";

const STEPS = ["REQUESTED", "APPROVED", "READY", "COLLECTED"];

export default async function RedemptionsPage() {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  const list = await loadRedemptions(s.partner.id);
  return (
    <>
      <PageHeader title={t("redemptionsPage.title")} subtitle={t("redemptionsPage.subtitle")} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title={t("redemptionsPage.empty")} action={<Link href="/partner/rewards" className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">{t("nav.rewards")}</Link>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const step = STEPS.indexOf(r.status);
            return (
              <Card key={r.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy-900">{r.reward}</p>
                    <p className="text-xs text-slate-500">{r.number} · {formatPts(r.points)} {t("common.pts")} · {t("redemptionsPage.requestedOn", { date: formatDisplayDate(r.requestedAt, lang) })}</p>
                  </div>
                  <Badge tone={r.status}>{t(`redemptionStatus.${r.status}`)}</Badge>
                </div>
                {r.status === "REJECTED" ? (
                  <p className="mt-2 text-sm text-rose-600">{t("redemptionsPage.reason", { reason: r.reason })}</p>
                ) : (
                  <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Progress">
                    {STEPS.map((st, i) => (
                      <li key={st} className="text-center">
                        <div className={`h-1.5 rounded-full ${i <= step ? "bg-navy-700" : "bg-slate-200"}`} />
                        <p className={`mt-1 text-[11px] ${i <= step ? "font-medium text-navy-800" : "text-slate-400"}`}>{t(`redemptionStatus.${st}`)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
