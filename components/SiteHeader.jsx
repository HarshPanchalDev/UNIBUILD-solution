"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, User } from "lucide-react";
import Logo from "./Logo";
import { LanguageSwitch, useT } from "./client/I18n";

export default function SiteHeader() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#home", label: t("landing.navHome") },
    { href: "/#about", label: t("landing.navAbout") },
    { href: "/#how-it-works", label: t("landing.navHow") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-10 md:flex">
          {links.map((l, i) => (
            <Link key={l.href} href={l.href} className={`relative py-2 text-[15px] font-medium text-navy-900 hover:text-navy-600 ${i === 0 ? "after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded after:bg-brand-500" : ""}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitch />
          <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm hover:bg-brand-400">
            <User className="h-4 w-4 fill-navy-900" /> {t("landing.login")}
          </Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitch />
          <button className="rounded-lg p-2 text-navy-900" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-3 font-medium text-navy-900">{l.label}</Link>
          ))}
          <Link href="/login" className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand-500 py-3 font-semibold text-navy-900">
            <User className="h-4 w-4" /> {t("landing.login")}
          </Link>
        </div>
      )}
    </header>
  );
}
