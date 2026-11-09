"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, callApi, useToast, Spinner, FormError } from "@/components/client/feedback";
import { useT } from "@/components/client/I18n";
import { inputClass } from "@/components/ui";

export default function RedeemButton({ reward, canRedeem, shortBy }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();

  if (!canRedeem) {
    return (
      <span className="block rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-500 sm:text-sm">
        {shortBy > 0 ? t("rewardsPage.needMore", { n: shortBy.toLocaleString("en-IN") }) : t("rewardsPage.redeem")}
      </span>
    );
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const r = await callApi("/api/partner/redemptions", { body: { rewardId: reward.id, notes } });
      toast(t("rewardsPage.done", { number: r.number }));
      setOpen(false);
      setNotes("");
      router.push("/partner/redemptions");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full rounded-lg bg-navy-800 py-2 text-center text-sm font-semibold text-white hover:bg-navy-700">
        {t("rewardsPage.redeem")}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={t("rewardsPage.confirmTitle", { reward: reward.name })}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t("rewardsPage.confirmText", { points: reward.points.toLocaleString("en-IN") })}</p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("rewardsPage.notes")}</span>
            <textarea className={`${inputClass} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </label>
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} disabled={busy} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">{t("common.cancel")}</button>
            <button onClick={confirm} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-navy-800 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <Spinner />} {t("rewardsPage.confirm")}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
