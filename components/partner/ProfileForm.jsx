"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { callApi, useToast, Spinner, FormError } from "@/components/client/feedback";
import { useT } from "@/components/client/I18n";
import { inputClass } from "@/components/ui";

export function PhotoUpload({ photoUrl, initials }) {
  const { t } = useT();
  const [url, setUrl] = useState(photoUrl);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const input = useRef(null);

  async function upload(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast(t("profile.photoHint"), "error");
    setBusy(true);
    const form = new FormData();
    form.set("photo", file);
    try {
      const r = await callApi("/api/partner/profile/photo", { form });
      setUrl(`${r.url}?v=${Date.now()}`);
      toast(t("profile.saved"));
      router.refresh();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={() => input.current?.click()} className="relative" aria-label={t("profile.photo")} disabled={busy}>
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-brand-500 font-display text-3xl font-bold text-navy-900">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span className="absolute bottom-0 right-0 rounded-full bg-navy-800 p-1.5 text-white ring-2 ring-white">{busy ? <Spinner /> : <Camera className="h-4 w-4" />}</span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      <p className="mt-2 text-xs text-slate-400">{t("profile.photoHint")}</p>
    </div>
  );
}

export default function ProfileForm({ areaServed, whatsappOptIn }) {
  const { t } = useT();
  const [area, setArea] = useState(areaServed);
  const [wa, setWa] = useState(whatsappOptIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await callApi("/api/partner/profile", { method: "PATCH", body: { areaServed: area, whatsappOptIn: wa } });
      toast(t("profile.saved"));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("profile.area")}</span>
        <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} maxLength={160} />
      </label>
      <label className="flex items-center gap-2 text-sm text-navy-900">
        <input type="checkbox" className="h-4 w-4 accent-navy-800" checked={wa} onChange={(e) => setWa(e.target.checked)} /> {t("profile.whatsapp")}
      </label>
      <FormError>{error}</FormError>
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">{busy && <Spinner />} {t("common.save")}</button>
    </form>
  );
}
