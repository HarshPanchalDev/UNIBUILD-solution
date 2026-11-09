"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, FileUp, Download, CheckCircle2, Flag } from "lucide-react";
import ActionDialog from "@/components/client/ActionDialog";
import { Modal, callApi, useToast, Spinner, FormError } from "@/components/client/feedback";

export function MergeSitesButton({ defaultCode = "" }) {
  const router = useRouter();
  return (
    <ActionDialog
      label="Merge sites"
      icon={GitMerge}
      title="Merge two Site Codes"
      description="Use when the same house was created twice. The OLDER code survives; links, points and history move to it, and the other code keeps working as an alias on future invoices. This cannot be undone."
      endpoint="/api/admin/sites/merge"
      fields={[
        { name: "codeA", label: "First Site Code", required: true, defaultValue: defaultCode, placeholder: "SAL-0012" },
        { name: "codeB", label: "Second Site Code", required: true, placeholder: "SAL-0201" },
        { name: "reason", label: "Reason", type: "textarea", required: true, placeholder: "Same house created twice at the counter" },
      ]}
      transform={(v) => ({ codeA: v.codeA.trim().toUpperCase(), codeB: v.codeB.trim().toUpperCase(), reason: v.reason })}
      confirmLabel="Merge"
      danger
      successMessage={(r) => `Merged: ${r.merged} is now an alias of ${r.survivor}`}
      onDone={(r) => router.push(`/admin/sites/${r.survivorId}`)}
    />
  );
}

export function SiteStatusButton({ siteId, status }) {
  const next = status === "ACTIVE" ? "COMPLETED" : "ACTIVE";
  return (
    <ActionDialog
      label={next === "COMPLETED" ? "Mark completed" : "Mark active"}
      icon={Flag}
      title={next === "COMPLETED" ? "Mark this site as completed?" : "Mark this site as active again?"}
      description="Completed sites can still receive invoices; links stay valid until they expire (SITE-03)."
      endpoint={`/api/admin/sites/${siteId}/status`}
      fields={[{ name: "reason", label: "Note", type: "textarea" }]}
      transform={(v) => ({ status: next, reason: v.reason })}
      confirmLabel="Confirm"
      successMessage="Status updated"
    />
  );
}

export function ImportSitesButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();

  async function send(mode, f = file) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", f);
    form.set("mode", mode);
    form.set("confirmDuplicates", String(confirmDuplicates));
    try {
      const res = await callApi("/api/admin/sites/import", { form });
      if (mode === "preview") setPreview(res);
      else {
        setResult(res);
        toast(`${res.created} of ${res.total} sites created`);
        router.refresh();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-navy-800 hover:bg-slate-50">
        <FileUp className="h-4 w-4" /> Import
      </button>
      <Modal open={open} onClose={close} title="Bulk import sites (field survey)" wide>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Excel or CSV with columns: Site Code, Owner name, Phone numbers (comma separated), Colony, Address, Google Maps link. Rows without a code get an SRV-#### code.</p>
          <a href="/api/admin/templates/sites-import" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline"><Download className="h-4 w-4" /> Download template</a>
          {!result && (
            <input
              type="file"
              accept=".xlsx,.csv"
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-4 file:py-2 file:font-medium file:text-navy-800"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                setPreview(null);
                if (f) send("preview", f);
              }}
            />
          )}
          {busy && <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Working…</p>}
          <FormError>{error}</FormError>
          {preview && !result && (
            <>
              <p className="text-sm text-navy-900"><b>{preview.total}</b> rows ready to import.</p>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={confirmDuplicates} onChange={(e) => setConfirmDuplicates(e.target.checked)} className="h-4 w-4 accent-navy-800" />
                Also create rows whose phone already belongs to another site in the same colony
              </label>
              <button disabled={busy} onClick={() => send("import")} className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">Import {preview.total} sites</button>
            </>
          )}
          {result && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> {result.created} of {result.total} created</p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 text-xs">
                <table className="w-full">
                  <tbody className="divide-y divide-slate-100">
                    {result.results.filter((r) => r.status !== "CREATED").map((r) => (
                      <tr key={r.row}><td className="px-3 py-1.5">Row {r.row}</td><td className="px-3 py-1.5 font-medium">{r.code || "—"}</td><td className="px-3 py-1.5 text-rose-700">{r.status === "DUPLICATE_PHONE" ? "Phone already on another site in this colony" : r.error}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Close</button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
