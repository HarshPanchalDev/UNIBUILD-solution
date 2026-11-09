"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2 } from "lucide-react";
import { Modal, callApi, Spinner, FormError, FieldError } from "@/components/client/feedback";
import { useT } from "@/components/client/I18n";
import { inputClass } from "@/components/ui";

export default function SiteRequestDialog() {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("EXISTING_SITE");
  const [code, setCode] = useState("");
  const [site, setSite] = useState({ ownerName: "", phone: "", colony: "", mapsUrl: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fe, setFe] = useState({});

  async function submit(e) {
    e.preventDefault();
    setError("");
    setFe({});
    const body = tab === "EXISTING_SITE" ? { type: tab, siteCode: code.trim().toUpperCase() } : { type: tab, ...site };
    setBusy(true);
    try {
      await callApi("/api/partner/site-requests", { body });
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
      if (err.details) setFe(err.details);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setSent(false);
    setCode("");
    setSite({ ownerName: "", phone: "", colony: "", mapsUrl: "" });
    setError("");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
        <Plus className="h-4 w-4" /> {t("sitesPage.request")}
      </button>
      <Modal open={open} onClose={close} title={t("sitesPage.request")}>
        {sent ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 text-sm text-slate-600">{t("sitesPage.sent")}</p>
            <button onClick={close} className="mt-5 w-full rounded-lg bg-navy-800 py-2.5 text-sm font-semibold text-white">{t("common.close")}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
              {[["EXISTING_SITE", t("sitesPage.existing")], ["NEW_SITE", t("sitesPage.newSite")]].map(([id, l]) => (
                <button type="button" key={id} onClick={() => { setTab(id); setError(""); setFe({}); }} className={`rounded-md py-2 ${tab === id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500"}`}>{l}</button>
              ))}
            </div>
            {tab === "EXISTING_SITE" ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("sitesPage.siteCode")}</span>
                <input className={`${inputClass} uppercase`} value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("sitesPage.siteCodePh")} autoCapitalize="characters" />
                <span className="mt-1 block text-xs text-slate-500">{t("sitesPage.siteCodeHint")}</span>
                <FieldError>{fe.siteCode}</FieldError>
              </label>
            ) : (
              <>
                {[
                  ["ownerName", t("sitesPage.ownerName"), "text"],
                  ["phone", t("sitesPage.ownerPhone"), "tel"],
                  ["colony", t("sitesPage.colony"), "text"],
                  ["mapsUrl", `${t("sitesPage.maps")} (${t("common.optional")})`, "url"],
                ].map(([k, label, type]) => (
                  <label key={k} className="block">
                    <span className="mb-1.5 block text-sm font-medium text-navy-900">{label}</span>
                    <input className={inputClass} type={type} inputMode={k === "phone" ? "numeric" : undefined} value={site[k]} onChange={(e) => setSite({ ...site, [k]: k === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value })} />
                    <FieldError>{fe[k]}</FieldError>
                  </label>
                ))}
              </>
            )}
            <FormError>{error}</FormError>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
              {busy && <Spinner />} {t("sitesPage.send")}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
