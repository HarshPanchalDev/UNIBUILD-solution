"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Modal, callApi, useToast, Spinner, FormError, FieldError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

const empty = { code: "", areaPrefix: "", displayName: "", ownerName: "", phones: [""], colony: "", address: "", mapsUrl: "", source: "ADMIN" };

/** Create or edit a site. Shows the SITE-01 duplicate-phone warning and asks for confirmation. */
export default function SiteForm({ site = null, initialCode = "", openInitially = false, buttonLabel }) {
  const editing = Boolean(site);
  const [open, setOpen] = useState(openInitially);
  const [v, setV] = useState(() => (site ? { ...empty, ...site, phones: site.phones.length ? site.phones : [""] } : { ...empty, code: initialCode }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicates, setDuplicates] = useState(null);
  const toast = useToast();
  const router = useRouter();

  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e, confirmDuplicates = false) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});
    const body = { ...v, phones: v.phones.map((p) => p.trim()).filter(Boolean), confirmDuplicates };
    try {
      if (editing) {
        await callApi(`/api/admin/sites/${site.id}`, { method: "PATCH", body: { displayName: body.displayName, ownerName: body.ownerName, phones: body.phones, colony: body.colony, address: body.address ?? "", mapsUrl: body.mapsUrl ?? "", isIncomplete: false, confirmDuplicates } });
        toast("Site updated");
        setOpen(false);
        setDuplicates(null);
        router.refresh();
      } else {
        const res = await callApi("/api/admin/sites", { body });
        toast(`Site ${res.code} created`);
        setOpen(false);
        setDuplicates(null);
        // No router.refresh() here: it would cancel this navigation.
        router.push(`/admin/sites/${res.id}`);
      }
    } catch (err) {
      if (err.code === "CONFLICT" && err.details?.duplicates) setDuplicates(err.details.duplicates);
      else {
        setError(err.message);
        if (err.details && typeof err.details === "object") setFieldErrors(err.details);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={editing ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-navy-800 hover:bg-slate-50" : "inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"}
      >
        {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {buttonLabel ?? (editing ? "Edit site" : "New site")}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? `Edit ${site.code}` : "New site"} wide>
        {duplicates ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> A phone number already belongs to an active site in {v.colony}. This may be the same house — consider using the existing site or merging later.
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
              {duplicates.map((d) => (
                <li key={`${d.siteId}-${d.phone}`} className="flex justify-between px-3 py-2">
                  <a href={`/admin/sites/${d.siteId}`} className="font-medium text-navy-700 underline" target="_blank" rel="noreferrer">{d.code}</a>
                  <span className="text-slate-600">{d.ownerName} · {d.phone}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => setDuplicates(null)}>Go back</button>
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700" onClick={() => submit(null, true)}>
                {busy && <Spinner />} {editing ? "Save anyway" : "Create anyway"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {!editing && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-navy-900">Site Code (as in BUSY)</span>
                  <input className={`${inputClass} uppercase`} value={v.code} onChange={set("code")} placeholder="SAL-0012" />
                  <span className="mt-1 block text-xs text-slate-500">Leave empty to auto-number with an area prefix.</span>
                  <FieldError>{fieldErrors.code}</FieldError>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-navy-900">…or area prefix</span>
                  <input className={`${inputClass} uppercase`} value={v.areaPrefix} onChange={set("areaPrefix")} placeholder="SAL" maxLength={5} disabled={Boolean(v.code)} />
                  <span className="mt-1 block text-xs text-slate-500">Creates the next free code, e.g. SAL-0013. Enter the same code in BUSY.</span>
                </label>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">Owner name</span>
                <input className={inputClass} value={v.ownerName} onChange={set("ownerName")} />
                <FieldError>{fieldErrors.ownerName}</FieldError>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">Name shown to partners <span className="font-normal text-slate-400">(optional)</span></span>
                <input className={inputClass} value={v.displayName ?? ""} onChange={set("displayName")} placeholder="e.g. Patel Building" />
                <span className="mt-1 block text-xs text-slate-500">Partners never see the owner&apos;s name or phone.</span>
              </label>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Phone numbers</span>
              <div className="space-y-2">
                {v.phones.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inputClass} value={p} inputMode="numeric" placeholder="10-digit mobile" onChange={(e) => setV({ ...v, phones: v.phones.map((x, j) => (j === i ? e.target.value : x)) })} />
                    {v.phones.length > 1 && (
                      <button type="button" className="rounded-lg border border-slate-200 px-3 text-slate-400 hover:text-rose-600" onClick={() => setV({ ...v, phones: v.phones.filter((_, j) => j !== i) })} aria-label="Remove phone">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {v.phones.length < 10 && <button type="button" className="mt-2 text-sm font-medium text-navy-600" onClick={() => setV({ ...v, phones: [...v.phones, ""] })}>+ Add phone (owner, family, contractor)</button>}
              <FieldError>{fieldErrors.phones}</FieldError>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">Colony</span>
                <input className={inputClass} value={v.colony} onChange={set("colony")} placeholder="Salaiya" />
                <FieldError>{fieldErrors.colony}</FieldError>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">Address <span className="font-normal text-slate-400">(optional)</span></span>
                <input className={inputClass} value={v.address ?? ""} onChange={set("address")} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Google Maps link <span className="font-normal text-slate-400">(optional)</span></span>
              <input className={inputClass} value={v.mapsUrl ?? ""} onChange={set("mapsUrl")} placeholder="https://maps.app.goo.gl/…" />
              <FieldError>{fieldErrors.mapsUrl}</FieldError>
            </label>
            {!editing && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900">Where did this site come from?</span>
                <select className={inputClass} value={v.source} onChange={set("source")}>
                  <option value="ADMIN">Added by staff</option>
                  <option value="COUNTER">Counter (first purchase)</option>
                  <option value="FIELD_SURVEY">Field survey</option>
                </select>
              </label>
            )}
            <FormError>{error}</FormError>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                {busy && <Spinner />} {editing ? "Save changes" : "Create site"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
