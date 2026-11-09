"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, callApi, useToast, Spinner, FormError, FieldError } from "./feedback";
import { inputClass } from "../ui";

/**
 * A button that opens a small form (reason, select, number…) and POSTs it.
 * fields: [{ name, label, type: "text"|"textarea"|"number"|"select"|"date", options?, required?, placeholder?, hint?, defaultValue? }]
 * transform(values) -> request body. On success: toast + router.refresh().
 */
export default function ActionDialog({
  label,
  title,
  description,
  endpoint,
  method = "POST",
  fields = [],
  confirmLabel = "Confirm",
  successMessage = "Done",
  danger = false,
  buttonClass,
  icon: Icon,
  transform,
  onDone,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const toast = useToast();
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    const fe = {};
    for (const f of fields) if (f.required && !String(values[f.name] ?? "").trim()) fe[f.name] = `${f.label} is required`;
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError("");
    try {
      const body = transform ? transform(values) : values;
      const res = await callApi(endpoint, { method, body });
      toast(typeof successMessage === "function" ? successMessage(res) : successMessage);
      setOpen(false);
      setValues(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])));
      onDone?.(res);
      router.refresh();
    } catch (err) {
      setError(err.message);
      if (err.details && typeof err.details === "object") setFieldErrors(err.details);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    buttonClass ??
    (danger
      ? "inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
      : "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-navy-800 hover:bg-slate-50");

  return (
    <>
      <button type="button" className={`${btn} disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => setOpen(true)} disabled={disabled}>
        {Icon && <Icon className="h-4 w-4" />} {label}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={title ?? label}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {description && <div className="text-sm text-slate-600">{description}</div>}
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">
                {f.label} {!f.required && <span className="font-normal text-slate-400">(optional)</span>}
              </span>
              {f.type === "textarea" ? (
                <textarea className={`${inputClass} min-h-24`} value={values[f.name]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} maxLength={500} />
              ) : f.type === "select" ? (
                <select className={inputClass} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={inputClass} type={f.type ?? "text"} value={values[f.name]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              )}
              {f.hint && <span className="mt-1 block text-xs text-slate-500">{f.hint}</span>}
              <FieldError>{fieldErrors[f.name]}</FieldError>
            </label>
          ))}
          <FormError>{error}</FormError>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-navy-800 hover:bg-navy-700"}`}>
              {busy && <Spinner />} {confirmLabel}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
