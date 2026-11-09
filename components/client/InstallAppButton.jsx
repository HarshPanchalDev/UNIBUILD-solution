"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useT } from "./I18n";

/** Uses the browser's install prompt (Android Chrome). Elsewhere it opens the sign-in page. */
export default function InstallAppButton() {
  const { t } = useT();
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  async function click() {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice.catch(() => {});
      setPrompt(null);
    } else {
      window.location.href = "/login";
    }
  }
  return (
    <button type="button" onClick={click} className="flex items-center gap-3 rounded-lg border border-white/40 bg-navy-950/40 px-5 py-2.5 text-left text-white hover:bg-navy-950/70">
      <Smartphone className="h-7 w-7 text-brand-400" />
      <span className="leading-tight">
        <span className="block text-xs text-white/80">{t("landing.installHint")}</span>
        <span className="block text-base font-semibold">{t("landing.install")}</span>
      </span>
    </button>
  );
}
