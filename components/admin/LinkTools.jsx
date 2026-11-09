"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink, RefreshCcw, Repeat, Check, X } from "lucide-react";
import { Modal, callApi, useToast, Spinner, FormError } from "@/components/client/feedback";
import ActionDialog from "@/components/client/ActionDialog";
import { inputClass } from "@/components/ui";
import { PartnerPicker, SitePicker } from "./Pickers";

const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

/** Create a partner–site link. If `site` is given the site is fixed. */
export function CreateLinkButton({ site = null, label = "Link a partner" }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(site);
  const [p, setP] = useState(null);
  const [startDate, setStartDate] = useState(today());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    if (!s || !p) return setError("Choose a site and a partner");
    if (reason.trim().length < 3) return setError("Enter how you confirmed who works on this site");
    setBusy(true);
    setError("");
    try {
      await callApi("/api/admin/links", { body: { siteId: s.id, partnerId: p.id, startDate, reason } });
      toast(`${p.code} linked to ${s.code}`);
      setOpen(false);
      setP(null);
      setReason("");
      if (!site) setS(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
        <Link2 className="h-4 w-4" /> {label}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Link a partner to a site">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Site</span>
            {site ? <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm"><b>{site.code}</b> · {site.ownerName}</p> : <SitePicker value={s} onChange={setS} />}
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Partner</span>
            <PartnerPicker value={p} onChange={setP} />
            <p className="mt-1 text-xs text-slate-500">The link is for the partner&apos;s trade. One active partner per trade per site.</p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Start date</span>
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="mt-1 block text-xs text-slate-500">Only invoices dated on or after this day earn points. The link lasts 12 months.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">How was this confirmed?</span>
            <textarea className={`${inputClass} min-h-20`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Owner confirmed at counter on call" maxLength={500} />
          </label>
          <FormError>{error}</FormError>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">{busy && <Spinner />} Create link</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ChangePartnerButton({ link }) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(null);
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();
  async function submit(e) {
    e.preventDefault();
    if (!p) return setError("Choose the new partner");
    if (reason.trim().length < 3) return setError("A reason is required (LNK-06)");
    setBusy(true);
    setError("");
    try {
      await callApi(`/api/admin/links/${link.id}/change`, { body: { newPartnerId: p.id, date, reason } });
      toast("Partner changed");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-navy-800 hover:bg-slate-50"><Repeat className="h-3.5 w-3.5" /> Change</button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`Change ${link.tradeLabel.toLowerCase()} on ${link.siteCode}`}>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">The current link ({link.partnerCode}) ends on the chosen day and the new partner starts the same day. Points already credited stay with {link.partnerCode}.</p>
          <PartnerPicker value={p} onChange={setP} trade={link.trade} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Change from</span>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Reason (recorded in the audit log)</span>
            <textarea className={`${inputClass} min-h-20`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
          <FormError>{error}</FormError>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <Spinner />} Change partner</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function LinkRowActions({ link }) {
  if (!link.active) return null;
  const small = "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-navy-800 hover:bg-slate-50";
  return (
    <div className="flex flex-wrap gap-1.5">
      <ActionDialog
        label="Renew"
        icon={RefreshCcw}
        buttonClass={small}
        title={`Renew link ${link.siteCode} · ${link.partnerCode}`}
        description={`Extends the link by another period from its current end date (${link.endDateLabel}).`}
        endpoint={`/api/admin/links/${link.id}/renew`}
        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true, defaultValue: "Work continues on site" }]}
        confirmLabel="Renew"
        successMessage={(r) => `Renewed until ${r.endDate}`}
      />
      <ChangePartnerButton link={link} />
      <ActionDialog
        label="End"
        icon={Unlink}
        buttonClass="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
        danger
        title={`End link ${link.siteCode} · ${link.partnerCode}?`}
        description="Invoices dated on or after the end date will not earn this partner points. Points already credited stay."
        endpoint={`/api/admin/links/${link.id}/end`}
        fields={[
          { name: "endDate", label: "End date", type: "date", defaultValue: today() },
          { name: "reason", label: "Reason", type: "textarea", required: true },
        ]}
        transform={(v) => ({ reason: v.reason, ...(v.endDate ? { endDate: v.endDate } : {}) })}
        confirmLabel="End link"
        successMessage="Link ended"
      />
    </div>
  );
}

export function LinkRequestActions({ req }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ActionDialog
        label="Approve & link"
        icon={Check}
        buttonClass="inline-flex items-center gap-1 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
        title={req.type === "NEW_SITE" ? "Create the site and link the partner" : `Link ${req.partnerCode} to ${req.siteCode}`}
        description={
          req.type === "NEW_SITE"
            ? "First create this site in BUSY, then enter the same Site Code here (or an area prefix to auto-number). The partner is linked from today."
            : "Confirm who is working on the site before linking (LNK-06)."
        }
        endpoint={`/api/admin/link-requests/${req.id}/approve`}
        fields={[
          ...(req.type === "NEW_SITE"
            ? [
                { name: "siteCode", label: "Site Code (as created in BUSY)", placeholder: "SAL-0013" },
                { name: "areaPrefix", label: "…or area prefix", placeholder: "SAL" },
              ]
            : []),
          { name: "reason", label: "How did you verify?", type: "textarea", required: true },
        ]}
        transform={(v) => ({ ...v, siteCode: (v.siteCode ?? "").trim().toUpperCase(), areaPrefix: (v.areaPrefix ?? "").trim().toUpperCase() })}
        confirmLabel="Approve"
        successMessage="Request approved and partner linked"
      />
      <ActionDialog
        label="Reject"
        icon={X}
        buttonClass="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
        danger
        title="Reject this request?"
        description="The partner sees the reason in their notices."
        endpoint={`/api/admin/link-requests/${req.id}/reject`}
        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
        confirmLabel="Reject"
        successMessage="Request rejected"
      />
    </div>
  );
}
