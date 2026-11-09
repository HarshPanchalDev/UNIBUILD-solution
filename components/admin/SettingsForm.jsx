"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, PlayCircle } from "lucide-react";
import { callApi, useToast, Spinner, FormError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

const CATS = { 1: "Cement", 2: "Waterproofing & Hardware", 3: "Plumbing", 4: "Electrical", 5: "Paint" };
const TRADES = { CONTRACTOR: "Contractor", PLUMBER: "Plumber", ELECTRICIAN: "Electrician", PAINTER: "Painter" };

function Section({ title, note, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-navy-900">{title}</h2>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const num = (v) => (v === "" || v === null || v === undefined ? "" : String(v));

export default function SettingsForm({ values }) {
  const [v, setV] = useState(() => structuredClone(values));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const toast = useToast();
  const router = useRouter();

  const setPath = (path, value) => {
    const next = structuredClone(v);
    let o = next;
    for (const k of path.slice(0, -1)) o = o[k];
    o[path.at(-1)] = value;
    setV(next);
  };
  const toNum = (s) => (s === "" ? "" : Number(s));
  const err = (k) => errors[k] && <p className="mt-1 text-xs text-rose-600">{errors[k]}</p>;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    const payload = structuredClone(v);
    for (const tr of Object.keys(payload.tierThresholds)) for (const t of ["SILVER", "GOLD"]) if (payload.tierThresholds[tr][t] === "") payload.tierThresholds[tr][t] = null;
    try {
      const r = await callApi("/api/admin/settings", { method: "PUT", body: { values: payload, note } });
      toast(`Saved as version #${r.versionId}. Applies to files uploaded from now on.`);
      setNote("");
      router.refresh();
    } catch (ex) {
      setError(ex.message);
      if (ex.details) setErrors(ex.details);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Earning rates" note="Cement earns per bag; other categories per rupees of taxable value (before GST). Points are always rounded down.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-2">Category</th><th className="py-2">Calculated on</th><th className="py-2">Points</th><th className="py-2">per</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(CATS).map(([id, name]) => (
                <tr key={id}>
                  <td className="py-2 pr-3 font-medium text-navy-900">{id}. {name}</td>
                  <td className="py-2 pr-3">
                    <select className={inputClass} value={v.rates[id].basis} onChange={(e) => setPath(["rates", id, "basis"], e.target.value)}>
                      <option value="QUANTITY">Quantity (bags/units)</option>
                      <option value="VALUE">Taxable value (₹)</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3"><input className={inputClass} type="number" step="0.0001" min="0" value={num(v.rates[id].points)} onChange={(e) => setPath(["rates", id, "points"], toNum(e.target.value))} />{err(`rates.${id}.points`)}</td>
                  <td className="py-2"><div className="flex items-center gap-1.5">{v.rates[id].basis === "VALUE" && <span className="text-slate-500">₹</span>}<input className={inputClass} type="number" step="0.0001" min="0" value={num(v.rates[id].per)} onChange={(e) => setPath(["rates", id, "per"], toNum(e.target.value))} /></div>{err(`rates.${id}.per`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Tiers" note="Multipliers are proposed (Q7). Thresholds are the paid purchase value on linked sites in the previous quarter, set per trade. Leave a threshold empty until the Owner decides — tiers for that trade are then not recalculated.">
        <div className="grid gap-4 sm:grid-cols-3">
          {["SAATHI", "SILVER", "GOLD"].map((t) => (
            <label key={t} className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">{t[0] + t.slice(1).toLowerCase()} multiplier</span>
              <input className={inputClass} type="number" step="0.01" min="0.01" value={num(v.multipliers[t])} onChange={(e) => setPath(["multipliers", t], toNum(e.target.value))} />
              {err(`multipliers.${t}`)}
            </label>
          ))}
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-2">Trade</th><th className="py-2">Silver from (₹/quarter)</th><th className="py-2">Gold from (₹/quarter)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(TRADES).map(([tr, label]) => (
                <tr key={tr}>
                  <td className="py-2 pr-3 font-medium text-navy-900">{label}</td>
                  {["SILVER", "GOLD"].map((t) => (
                    <td key={t} className="py-2 pr-3">
                      <input className={inputClass} type="number" min="0" placeholder="Not decided" value={num(v.tierThresholds[tr][t])} onChange={(e) => setPath(["tierThresholds", tr, t], toNum(e.target.value))} />
                      {err(`tierThresholds.${tr}.${t}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Points life and redemption" note="Values marked [Proposed] in the spec (Q6) — confirm with the Owner.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["lockDays", "Lock period (days)"],
            ["expiryMonths", "Expiry (months after credit)"],
            ["minRedeem", "Minimum to redeem (points)"],
            ["pointValue", "Value of 1 point (₹)"],
            ["linkMonths", "Link validity (months)"],
            ["linkReminderDays", "Link reminder (days before end)"],
          ].map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">{label}</span>
              <input className={inputClass} type="number" step={k === "pointValue" ? "0.01" : "1"} min="0" value={num(v[k])} onChange={(e) => setPath([k], toNum(e.target.value))} />
              {err(k)}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Returns larger than the balance" note="Open question Q3. The balance never goes below zero; choose what happens to the part that cannot be reversed.">
        <div className="space-y-2">
          {[
            ["CAP_AND_FLAG", "Deduct what the balance allows and record the rest for the Owner to decide (default)"],
            ["CARRY_FORWARD", "Deduct what the balance allows and recover the rest from the partner's next credited points"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-start gap-2 text-sm text-navy-900">
              <input type="radio" name="shortfall" className="mt-0.5 h-4 w-4 accent-navy-800" checked={v.shortfallPolicy === k} onChange={() => setPath(["shortfallPolicy"], k)} />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:items-end sm:rounded-2xl sm:border">
        <label className="block flex-1">
          <span className="mb-1.5 block text-sm font-medium text-navy-900">Note for this change <span className="font-normal text-slate-400">(saved in the audit log)</span></span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Diwali plumbing promotion" />
        </label>
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
          {busy ? <Spinner /> : <Save className="h-4 w-4" />} Save new version
        </button>
      </div>
      <FormError>{error}</FormError>
    </form>
  );
}

export function RunJobsButton() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  async function run() {
    setBusy(true);
    try {
      const r = await callApi("/api/admin/jobs");
      const x = r.result;
      toast(`Done: ${x.expiry.lotsExpired} lots expired, ${x.links.reminders} link reminders, ${x.links.expired} links expired${x.tiers ? `, ${x.tiers.changed} tier changes` : ""}`);
      router.refresh();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-navy-800 hover:bg-slate-50 disabled:opacity-60">
      {busy ? <Spinner /> : <PlayCircle className="h-4 w-4" />} Run daily jobs now
    </button>
  );
}
