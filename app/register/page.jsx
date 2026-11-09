"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, HardHat, Wrench, Zap, Paintbrush, Camera } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import OtpInput from "@/components/client/OtpInput";
import { useT } from "@/components/client/I18n";
import { callApi, Spinner, FormError, FieldError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

const TRADES = [
  { id: "CONTRACTOR", icon: HardHat },
  { id: "PLUMBER", icon: Wrench },
  { id: "ELECTRICIAN", icon: Zap },
  { id: "PAINTER", icon: Paintbrush },
];

// The optional photo is uploaded right after the account is created (upload needs a signed-in session).
export default function RegisterPage() {
  const { t } = useT();
  const [form, setForm] = useState({ name: "", mobile: "", trade: "", areaServed: "", terms: false, whatsappOptIn: true });
  const [step, setStep] = useState("details"); // details | otp
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fe, setFe] = useState({});
  const [photo, setPhoto] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = t("auth.errName");
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = t("auth.errMobile");
    if (!form.trade) e.trade = t("auth.errTrade");
    if (form.areaServed.trim().length < 2) e.areaServed = t("auth.errArea");
    if (!form.terms) e.terms = t("auth.errTerms");
    setFe(e);
    return Object.keys(e).length === 0;
  }

  async function sendOtp(e) {
    e?.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError("");
    try {
      const r = await callApi("/api/auth/otp", { body: { identifier: form.mobile, purpose: "register" } });
      setSentTo(r.sentTo);
      setDevOtp(r.devOtp ?? null);
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    if (code.length !== 6) return setError(t("auth.errCode"));
    setBusy(true);
    setError("");
    try {
      const r = await callApi("/api/auth/partner/register", { body: { ...form, code } });
      if (photo) {
        const fd = new FormData();
        fd.set("photo", photo);
        await callApi("/api/partner/profile/photo", { form: fd }).catch(() => {}); // can be added later from Profile
      }
      window.location.href = r.redirect || "/partner";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.registerTitle")} subtitle={t("auth.registerSub")}>
      {step === "details" ? (
        <form onSubmit={sendOtp} className="space-y-5" noValidate>
          <div className="flex items-center gap-4">
            <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200 hover:bg-slate-200">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= 2 * 1024 * 1024) setPhoto(f); }} />
            </label>
            <span className="text-sm text-slate-500">{t("profile.photo")} <span className="text-slate-400">({t("common.optional")})</span><br /><span className="text-xs text-slate-400">{t("profile.photoHint")}</span></span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("auth.name")}</span>
              <input className={inputClass} value={form.name} onChange={set("name")} placeholder={t("auth.namePh")} autoComplete="name" maxLength={120} />
              <FieldError>{fe.name}</FieldError>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("auth.mobile")}</span>
              <input className={inputClass} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder={t("auth.mobilePh")} inputMode="numeric" autoComplete="tel-national" />
              <FieldError>{fe.mobile}</FieldError>
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("auth.trade")}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("auth.trade")}>
              {TRADES.map(({ id, icon: Icon }) => (
                <button type="button" role="radio" aria-checked={form.trade === id} key={id} onClick={() => setForm({ ...form, trade: id })} className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition ${form.trade === id ? "border-navy-700 bg-navy-50 text-navy-800 ring-1 ring-navy-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                  <Icon className="h-5 w-5" /> {t(`trade.${id}`)}
                </button>
              ))}
            </div>
            <FieldError>{fe.trade}</FieldError>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("auth.area")}</span>
            <input className={inputClass} value={form.areaServed} onChange={set("areaServed")} placeholder={t("auth.areaPh")} maxLength={160} />
            <FieldError>{fe.areaServed}</FieldError>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.whatsappOptIn} onChange={set("whatsappOptIn")} className="mt-0.5 h-4 w-4 accent-navy-800" /> {t("auth.whatsapp")}
          </label>
          <div>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.terms} onChange={set("terms")} className="mt-0.5 h-4 w-4 shrink-0 accent-navy-800" /> <span>{t("auth.terms")}</span>
            </label>
            <FieldError>{fe.terms}</FieldError>
          </div>
          <FormError>{error}</FormError>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
            {busy && <Spinner />} {t("auth.continue")}
          </button>
        </form>
      ) : (
        <form onSubmit={create} className="space-y-5">
          <button type="button" onClick={() => { setStep("details"); setError(""); }} className="flex items-center gap-1 text-sm text-navy-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </button>
          <p className="text-sm text-navy-900">{t("auth.otpSent", { to: sentTo })}</p>
          <OtpInput value={code} onChange={setCode} label={t("auth.otpLabel")} />
          {devOtp && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("auth.devOtp", { code: devOtp })}</p>}
          <button type="button" disabled={busy} onClick={sendOtp} className="text-sm font-medium text-navy-600 hover:underline">{t("auth.resend")}</button>
          <FormError>{error}</FormError>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
            {busy && <Spinner />} {t("auth.createAccount")}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        {t("auth.already")} <Link href="/login" className="font-semibold text-navy-700 underline underline-offset-2">{t("auth.signIn")}</Link>
      </p>
    </AuthShell>
  );
}
