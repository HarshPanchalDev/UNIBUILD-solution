import { MapPin, Building2, ExternalLink } from "lucide-react";
import { Badge, Card, PageHeader, EmptyState } from "@/components/ui";
import SiteRequestDialog from "@/components/partner/SiteRequestDialog";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { loadSites, loadLinkRequests } from "@/lib/server/partnerData";
import { formatDisplayDate } from "@/lib/loyalty/dates";

export default async function SitesPage() {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  const [sites, requests] = await Promise.all([loadSites(s.partner.id), loadLinkRequests(s.partner.id)]);
  const canRequest = s.partner.status === "APPROVED";

  return (
    <>
      <PageHeader title={t("sitesPage.title")} subtitle={t("sitesPage.subtitle")} action={canRequest ? <SiteRequestDialog /> : null} />
      {sites.length === 0 ? (
        <Card><EmptyState icon={Building2} title={t("sitesPage.empty")} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((x) => (
            <Card key={x.linkId} className={`p-4 sm:p-5 ${x.active ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{x.site.name}</p>
                  <p className="text-sm font-semibold text-navy-600">{x.site.code}</p>
                </div>
                <Badge tone={x.active ? "ACTIVE" : "ENDED"}>{x.active ? t("sitesPage.active") : t("sitesPage.ended")}</Badge>
              </div>
              <p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {x.site.colony}</p>
              {x.site.ownerName && <p className="text-sm text-slate-500">{t("sitesPage.ownerName")}: {x.site.ownerName}</p>}
              <p className="mt-1 text-sm text-slate-600">{x.categories.map((c) => t(`category.${c}`)).join(", ")}</p>
              <p className="mt-2 text-xs text-slate-400">
                {t("sitesPage.since", { date: formatDisplayDate(x.startDate, lang) })} · {t("sitesPage.validTill", { date: formatDisplayDate(x.endDate, lang) })}
              </p>
              {x.site.mapsUrl && (
                <a href={x.site.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy-600">
                  Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </Card>
          ))}
        </div>
      )}

      {requests.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-navy-900">{t("sitesPage.requests")}</h2>
          <Card className="divide-y divide-slate-100">
            {requests.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900">{r.type === "EXISTING_SITE" ? r.siteCode : `${t("sitesPage.newSite")} · ${r.colony}`}</p>
                  <p className="text-xs text-slate-500">{formatDisplayDate(r.createdAt, lang)}{r.ownerName ? ` · ${r.ownerName}` : ""}</p>
                  {r.note && <p className="mt-1 text-xs text-rose-600">{r.note}</p>}
                </div>
                <Badge tone={r.status}>{t(r.status === "PENDING" ? "sitesPage.reqPending" : r.status === "APPROVED" ? "sitesPage.reqApproved" : "sitesPage.reqRejected")}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
