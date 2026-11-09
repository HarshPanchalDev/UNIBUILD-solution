"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Undo2, Gift, BadgeCheck, Link2, Bell, Clock } from "lucide-react";
import { callApi } from "@/components/client/feedback";
import { useT } from "@/components/client/I18n";

const ICON = {
  POINTS_CREDITED: [Star, "bg-emerald-50 text-emerald-600"],
  POINTS_UNLOCKED: [Star, "bg-emerald-50 text-emerald-600"],
  POINTS_REVERSED: [Undo2, "bg-rose-50 text-rose-600"],
  POINTS_EXPIRED: [Clock, "bg-slate-100 text-slate-500"],
  POINTS_ADJUSTED: [Star, "bg-violet-50 text-violet-600"],
  TIER_CHANGED: [BadgeCheck, "bg-navy-50 text-navy-600"],
  PARTNER_APPROVED: [BadgeCheck, "bg-emerald-50 text-emerald-600"],
  LINK_CREATED: [Link2, "bg-sky-50 text-sky-600"],
  LINK_ENDED: [Link2, "bg-slate-100 text-slate-500"],
  LINK_EXPIRING: [Link2, "bg-amber-50 text-amber-600"],
};

export default function NoticeList({ notices, lang }) {
  const { t } = useT();
  const router = useRouter();
  const [items, setItems] = useState(notices);
  const unread = items.filter((n) => !n.read).length;

  async function mark(ids, all = false) {
    setItems(items.map((n) => (all || ids.includes(n.id) ? { ...n, read: true } : n)));
    await callApi("/api/partner/notices", { body: all ? { all: true } : { ids } }).catch(() => {});
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{unread ? t("noticesPage.unread", { n: unread }) : t("noticesPage.allRead")}</p>
        {unread > 0 && <button onClick={() => mark([], true)} className="text-sm font-medium text-navy-600 hover:underline">{t("noticesPage.markAll")}</button>}
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">{t("noticesPage.empty")}</div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {items.map((n) => {
            const [Icon, cls] = ICON[n.type] ?? (n.type.startsWith("REDEMPTION") ? [Gift, "bg-brand-50 text-brand-600"] : [Bell, "bg-slate-100 text-slate-500"]);
            return (
              <button key={n.id} onClick={() => !n.read && mark([n.id])} className={`flex w-full items-start gap-3 p-4 text-left sm:p-5 ${n.read ? "" : "bg-brand-50/40"}`}>
                <div className={`rounded-xl p-2.5 ${cls}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm text-navy-900 ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</p>
                    <span className="shrink-0 text-xs text-slate-400">{new Date(n.createdAt).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                </div>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="unread" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
