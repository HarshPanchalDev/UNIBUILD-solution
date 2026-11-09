"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { translate, getDict } from "@/lib/i18n";

const Ctx = createContext({ lang: "hi", t: (k) => k });

export function I18nProvider({ lang, children }) {
  const value = useMemo(() => {
    const dict = getDict(lang);
    return { lang, t: (key, vars) => translate(dict, key, vars) };
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

/** हिंदी / English switch. Saves a cookie and reloads server-rendered text. */
export function LanguageSwitch({ className = "", dark = false }) {
  const { lang } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function choose(next) {
    if (next === lang || busy) return;
    setBusy(true);
    await fetch("/api/lang", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: next }) }).catch(() => {});
    router.refresh();
    setBusy(false);
  }
  const base = dark ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-navy-900";
  const on = dark ? "bg-white/15 text-white" : "bg-navy-800 text-white";
  return (
    <div className={`inline-flex items-center gap-1 rounded-lg p-0.5 text-xs font-semibold ${dark ? "bg-white/5 ring-1 ring-white/15" : "bg-white ring-1 ring-slate-200"} ${className}`} role="group" aria-label="Language">
      <Languages className={`ml-1.5 h-3.5 w-3.5 ${dark ? "text-white/60" : "text-slate-400"}`} aria-hidden="true" />
      {[["hi", "हिंदी"], ["en", "EN"]].map(([k, label]) => (
        <button key={k} type="button" onClick={() => choose(k)} aria-pressed={lang === k} className={`rounded-md px-2.5 py-1 transition ${lang === k ? on : base}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
