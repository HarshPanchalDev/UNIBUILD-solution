import Link from "next/link";
import { ClipboardList, Bell, ChevronRight } from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import ProfileForm, { PhotoUpload } from "@/components/partner/ProfileForm";
import LogoutButton from "@/components/client/LogoutButton";
import { LanguageSwitch } from "@/components/client/I18n";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { fileUrl } from "@/lib/server/storage";
import { formatDisplayDate } from "@/lib/loyalty/dates";

export default async function ProfilePage() {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  const p = s.partner;
  const initials = s.user.name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const rows = [
    [t("profile.code"), p.code ?? t("profile.pendingCode")],
    [t("profile.trade"), t(`trade.${p.trade}`)],
    [t("profile.mobile"), `+91 ${s.user.mobile}`],
    [t("profile.tier"), <Badge key="t" tone={p.tier}>{t(`tier.${p.tier}`)}</Badge>],
    [t("profile.since"), formatDisplayDate((p.approvedAt ?? p.createdAt).toISOString(), lang)],
  ];
  return (
    <>
      <PageHeader title={t("profile.title")} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-6 text-center">
          <PhotoUpload photoUrl={fileUrl(p.photoKey)} initials={initials} />
          <p className="mt-4 font-display text-lg font-semibold text-navy-900">{s.user.name}</p>
          <p className="text-sm text-slate-500">{t(`trade.${p.trade}`)} · {p.code}</p>
          <div className="mt-6 space-y-2 text-left lg:hidden">
            {[["/partner/redemptions", ClipboardList, t("nav.redemptions")], ["/partner/notices", Bell, t("nav.notices")]].map(([href, Icon, label]) => (
              <Link key={href} href={href} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-medium text-navy-900">
                <span className="flex items-center gap-3"><Icon className="h-5 w-5 text-navy-600" /> {label}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="mt-0.5 font-medium text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-t border-slate-100 pt-6">
            <ProfileForm areaServed={p.areaServed} whatsappOptIn={p.whatsappOptIn} />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <div>
              <p className="mb-2 text-xs text-slate-500">{t("common.language")}</p>
              <LanguageSwitch />
            </div>
            <LogoutButton className="text-sm font-medium text-rose-600" label={t("common.logout")} iconClass="h-4 w-4" />
          </div>
        </Card>
      </div>
    </>
  );
}
