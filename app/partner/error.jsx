"use client";

import { AlertTriangle } from "lucide-react";
import { useT } from "@/components/client/I18n";

export default function PartnerError({ reset }) {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
      <p className="mt-3 font-semibold text-navy-900">{t("common.error")}</p>
      <button onClick={reset} className="mt-5 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white">{t("common.retry")}</button>
    </div>
  );
}
