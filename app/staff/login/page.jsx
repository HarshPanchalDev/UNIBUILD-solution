"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { callApi, Spinner, FormError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

export default function StaffLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState(null); // { sentTo, devOtp }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = otp
        ? await callApi("/api/auth/staff/verify", { body: { identifier, password, code } })
        : await callApi("/api/auth/staff/login", { body: { identifier, password } });
      if (res.otpRequired) setOtp({ sentTo: res.sentTo, devOtp: res.devOtp });
      else window.location.href = res.redirect || "/admin";
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo subtitle="ADMIN PANEL" /></div>
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h1 className="font-display text-xl font-bold text-navy-900">Staff sign in</h1>
          <p className="mt-1 text-sm text-slate-500">For the Store Manager and Owner.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Email or mobile</span>
              <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" disabled={Boolean(otp)} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Password</span>
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={Boolean(otp)} required />
            </label>
            {otp && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">One-time code sent to {otp.sentTo}</span>
                <input className={`${inputClass} tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus />
                {otp.devOtp && <span className="mt-1 block rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Development mode — code {otp.devOtp}</span>}
              </label>
            )}
            <FormError>{error}</FormError>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
              {busy ? <Spinner /> : <ShieldCheck className="h-4 w-4" />} {otp ? "Verify and sign in" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">Partner? <Link href="/login" className="font-semibold text-navy-700 underline">Partner sign in</Link></p>
      </div>
    </div>
  );
}
