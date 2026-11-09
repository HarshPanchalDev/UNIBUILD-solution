import { Hourglass, XCircle } from "lucide-react";
import PartnerShell from "@/components/client/PartnerShell";
import LogoutButton from "@/components/client/LogoutButton";
import { LanguageSwitch } from "@/components/client/I18n";
import Logo from "@/components/Logo";
import { requirePartnerPage } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { getT } from "@/lib/i18n/server";
import { fileUrl } from "@/lib/server/storage";
import { I18nProvider } from "@/components/client/I18n";

export const metadata = { title: "UNIBUILD Partner App", robots: { index: false } };
export const dynamic = "force-dynamic";

function StatusScreen({ lang, t, status, reason }) {
  const pending = status === "PENDING";
  return (
    <I18nProvider lang={lang}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="flex h-14 items-center justify-between bg-navy-900 px-4">
          <Logo light subtitle="PARTNER APP" href="/" />
          <LanguageSwitch dark />
        </header>
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${pending ? "bg-brand-50 text-brand-600" : "bg-rose-50 text-rose-600"}`}>
              {pending ? <Hourglass className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
            </div>
            <h1 className="mt-4 font-display text-xl font-bold text-navy-900">{t(pending ? "status.pendingTitle" : "status.rejectedTitle")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{pending ? t("status.pendingText") : t("status.rejectedText", { reason: reason ?? "—" })}</p>
            {pending && <p className="mt-3 text-xs text-slate-400">{t("status.pendingNote")}</p>}
            <LogoutButton className="mx-auto mt-6 justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy-800" label={t("common.logout")} iconClass="h-4 w-4" />
          </div>
        </main>
      </div>
    </I18nProvider>
  );
}

export default async function PartnerLayout({ children }) {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  if (s.partner.status === "PENDING" || s.partner.status === "REJECTED") {
    return <StatusScreen lang={lang} t={t} status={s.partner.status} reason={s.partner.statusReason} />;
  }
  const unread = await prisma.notification.count({ where: { audience: "PARTNER", userId: s.user.id, readAt: null } });
  return (
    <PartnerShell lang={lang} unread={unread} partner={{ name: s.user.name, code: s.partner.code, photoUrl: fileUrl(s.partner.photoKey) }}>
      {s.partner.status === "SUSPENDED" && (
        <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
          <b>{t("status.suspendedTitle")}.</b> {t("status.suspendedText", { reason: s.partner.statusReason ?? "—" })}
        </div>
      )}
      {children}
    </PartnerShell>
  );
}
