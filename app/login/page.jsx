"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import OtpInput from "@/components/client/OtpInput";
import { useT } from "@/components/client/I18n";
import { callApi, Spinner, FormError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

export default function LoginPage() {
  const { t } = useT();
  const [step, setStep] = useState("id"); // id | otp
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notRegistered, setNotRegistered] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(e) {
    e?.preventDefault();
    const v = identifier.trim();
    if (!/^[6-9]\d{9}$/.test(v.replace(/\D/g, "").slice(-10)) && !/^UBP-(CO|PL|EL|PA)-\d{4,}$/i.test(v)) {
      setError(t("auth.errMobile"));
      return;
    }
    setBusy(true);
    setError("");
    setNotRegistered(false);
    try {
      const r = await callApi("/api/auth/otp", { body: { identifier: v, purpose: "login" } });
      setSentTo(r.sentTo);
      setDevOtp(r.devOtp ?? null);
      setStep("otp");
      setCode("");
      setWait(30);
    } catch (err) {
      setError(err.message);
      setNotRegistered(err.code === "NOT_REGISTERED");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    if (code.length !== 6) return setError(t("auth.errCode"));
    setBusy(true);
    setError("");
    try {
      const r = await callApi("/api/auth/partner/login", { body: { identifier: identifier.trim(), code } });
      window.location.href = r.redirect || "/partner";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.welcome")} subtitle={t("auth.welcomeSub")}>
      {step === "id" ? (
        <form onSubmit={send} className="space-y-5" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">{t("auth.identifier")}</span>
            <input className={inputClass} placeholder={t("auth.identifierPh")} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="tel" inputMode="text" autoFocus />
          </label>
          <FormError>{error}</FormError>
          {notRegistered && <Link href="/register" className="block text-center text-sm font-semibold text-navy-700 underline">{t("auth.registerNow")}</Link>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
            {busy && <Spinner />} {busy ? t("auth.sending") : t("auth.sendOtp")}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <button type="button" onClick={() => { setStep("id"); setError(""); }} className="flex items-center gap-1 text-sm text-navy-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("auth.change")}
          </button>
          <div>
            <p className="mb-3 text-sm text-navy-900">{t("auth.otpSent", { to: sentTo })}</p>
            <OtpInput value={code} onChange={setCode} label={t("auth.otpLabel")} />
            {devOtp && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("auth.devOtp", { code: devOtp })}</p>}
            <button type="button" disabled={wait > 0 || busy} onClick={send} className="mt-3 text-sm font-medium text-navy-600 hover:underline disabled:text-slate-400 disabled:no-underline">
              {wait > 0 ? t("auth.resendIn", { s: wait }) : t("auth.resend")}
            </button>
          </div>
          <FormError>{error}</FormError>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
            {busy && <Spinner />} {busy ? t("auth.verifying") : t("auth.verify")}
          </button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        {t("auth.newPartner")} <Link href="/register" className="font-semibold text-navy-700 underline underline-offset-2">{t("auth.registerNow")}</Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        <Link href="/staff/login" className="underline">{t("landing.staffLogin")}</Link>
      </p>
    </AuthShell>
  );
}
