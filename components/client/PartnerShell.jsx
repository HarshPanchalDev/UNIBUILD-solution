"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Star, Building2, Gift, ClipboardList, Bell, User, MapPin, Menu } from "lucide-react";
import Logo from "../Logo";
import LogoutButton from "./LogoutButton";
import { I18nProvider, LanguageSwitch, useT } from "./I18n";
import { ToastProvider } from "./feedback";

function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}

function Shell({ partner, unread, children }) {
  const { t } = useT();
  const pathname = usePathname();
  const isActive = (href) => (href === "/partner" ? pathname === "/partner" : pathname.startsWith(href));

  const nav = [
    { href: "/partner", label: t("nav.home"), icon: Home },
    { href: "/partner/points", label: t("nav.points"), icon: Star },
    { href: "/partner/sites", label: t("nav.sites"), icon: Building2 },
    { href: "/partner/rewards", label: t("nav.rewards"), icon: Gift },
    { href: "/partner/redemptions", label: t("nav.redemptions"), icon: ClipboardList },
    { href: "/partner/notices", label: t("nav.notices"), icon: Bell, badge: unread },
    { href: "/partner/profile", label: t("nav.profile"), icon: User },
  ];
  const tabs = [
    { href: "/partner", label: t("nav.home"), icon: Home },
    { href: "/partner/points", label: t("nav.pointsShort"), icon: Star },
    { href: "/partner/sites", label: t("nav.sitesShort"), icon: MapPin },
    { href: "/partner/rewards", label: t("nav.rewards"), icon: Gift },
    { href: "/partner/profile", label: t("nav.more"), icon: Menu },
  ];
  const initials = partner.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between bg-navy-900 px-4 py-6 lg:flex">
        <div>
          <div className="mb-8 px-1"><Logo light subtitle="PARTNER APP" href="/partner" /></div>
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon, badge }) => (
              <Link key={href} href={href} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive(href) ? "bg-navy-600 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
                <span className="flex items-center gap-3"><Icon className="h-[18px] w-[18px]" /> {label}</span>
                {badge > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-navy-900">{badge}</span>}
              </Link>
            ))}
          </nav>
        </div>
        <div className="space-y-4 border-t border-white/10 pt-4">
          <LanguageSwitch dark />
          <div className="flex items-center gap-3">
            {partner.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-navy-900">{initials}</div>
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{partner.name}</p>
              <p className="truncate text-xs text-white/60">{partner.code ?? t("profile.pendingCode")}</p>
            </div>
          </div>
          <LogoutButton className="px-1 text-sm text-white/75 hover:text-white" label={t("common.logout")} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy-900 px-4 lg:hidden">
        <Logo light subtitle="PARTNER APP" href="/partner" />
        <div className="flex items-center gap-2">
          <LanguageSwitch dark />
          <Link href="/partner/notices" className="relative p-1.5 text-white" aria-label={t("nav.notices")}>
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-navy-900" />}
          </Link>
        </div>
      </header>

      <main className="pb-24 lg:pb-0 lg:pl-60">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main">
        {tabs.map(({ href, label, icon: Icon }) => {
          const on = isActive(href) || (href === "/partner/profile" && (pathname.startsWith("/partner/redemptions") || pathname.startsWith("/partner/notices")));
          return (
            <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${on ? "text-navy-800" : "text-slate-400"}`} aria-current={on ? "page" : undefined}>
              <Icon className={`h-5 w-5 ${on ? "fill-navy-800/10" : ""}`} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function PartnerShell({ lang, partner, unread, children }) {
  return (
    <I18nProvider lang={lang}>
      <ToastProvider>
        <RegisterServiceWorker />
        <Shell partner={partner} unread={unread}>{children}</Shell>
      </ToastProvider>
    </I18nProvider>
  );
}
