"use client";

import Logo from "./Logo";
import { LanguageSwitch, useT } from "./client/I18n";

function CitySketch() {
  return (
    <svg viewBox="0 0 260 170" className="w-full max-w-xs text-navy-200/50" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      {/* crane */}
      <path d="M40 160V20M34 160V20M34 30h-20M40 20h90M40 20l14-12 0 12M60 20v6M90 20v-4M120 20v30" />
      <path d="M34 40l6 10M34 60l6 10M34 80l6 10M34 100l6 10M34 120l6 10M34 140l6 10" />
      <rect x="114" y="50" width="12" height="8" />
      {/* tower */}
      <path d="M150 160V60h60v100M150 80h60M150 100h60M150 120h60M150 140h60M170 60v100M190 60v100" />
      <path d="M160 60V45h40v15M175 45V35h10v10" />
      {/* low buildings */}
      <path d="M70 160v-45h55v45M70 130h55M88 115v45M106 115v45" />
      <path d="M215 160v-30h35v30M215 145h35" />
      <path d="M0 160h260" stroke="#fdb913" strokeWidth="2" />
    </svg>
  );
}

export default function AuthShell({ title, subtitle, children }) {
  const { t } = useT();
  return (
    <div className="flex min-h-screen items-stretch justify-center bg-slate-100 p-0 sm:items-center sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden bg-white shadow-xl sm:rounded-2xl md:grid-cols-[2fr_3fr]">
        <aside className="flex flex-col justify-between bg-navy-800 p-6 text-white md:min-h-[560px] md:p-8">
          <div>
            <Logo light subtitle="BUILDING TOGETHER" size="lg" />
            <h2 className="mt-6 font-display text-2xl font-semibold md:mt-12">{t("auth.sideTitle")}</h2>
            <p className="mt-3 max-w-[16rem] text-white/80">{t("auth.sideText")}</p>
          </div>
          <div className="mt-10 hidden md:block">
            <CitySketch />
          </div>
        </aside>
        <main className="p-6 sm:p-10 md:p-12">
          <div className="mb-6 flex justify-end"><LanguageSwitch /></div>
          <h1 className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
