"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, X } from "lucide-react";
import { callApi, useToast, Spinner, FormError } from "@/components/client/feedback";

const KINDS = [
  { id: "INVOICE", label: "Paid invoices", template: "paid-invoices" },
  { id: "CREDIT_NOTE", label: "Credit notes (returns)", template: "credit-notes" },
];

/** XHR so we can show upload progress for large files. */
function postWithProgress(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(Object.assign(new Error(data.error || "Upload failed"), { details: data.details }));
    };
    xhr.onerror = () => reject(new Error("Could not reach the server. Check your connection."));
    xhr.send(form);
  });
}

export default function UploadPanel() {
  const [kind, setKind] = useState("INVOICE");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | previewing | uploading | processing | done
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const input = useRef(null);
  const toast = useToast();
  const router = useRouter();

  function pick(f) {
    setResult(null);
    setPreview(null);
    setError("");
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) return setError("Only .xlsx and .csv files are accepted");
    if (f.size > 10 * 1024 * 1024) return setError("File must be 10 MB or smaller");
    setFile(f);
    runPreview(f, kind);
  }

  async function runPreview(f, k) {
    setStage("previewing");
    const form = new FormData();
    form.set("kind", k);
    form.set("mode", "preview");
    form.set("file", f);
    try {
      const res = await callApi("/api/admin/uploads", { form });
      setPreview(res.preview);
    } catch (e) {
      setError(e.message);
    } finally {
      setStage("idle");
    }
  }

  async function process() {
    if (!file) return;
    setStage("uploading");
    setError("");
    setProgress(0);
    const form = new FormData();
    form.set("kind", kind);
    form.set("mode", "process");
    form.set("file", file);
    try {
      const res = await postWithProgress("/api/admin/uploads", form, (p) => {
        setProgress(p);
        if (p === 100) setStage("processing");
      });
      setResult(res);
      setStage("done");
      toast(res.rejected ? "File rejected — see details" : `Processed: ${res.summary.pointsCredited || res.summary.pointsReversed || 0} points`, res.rejected ? "error" : "success");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setStage("idle");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setStage("idle");
    if (input.current) input.current.value = "";
  }

  const busy = stage === "uploading" || stage === "processing" || stage === "previewing";
  const tmpl = KINDS.find((k) => k.id === kind).template;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {KINDS.map((k) => (
            <button key={k.id} type="button" disabled={busy} onClick={() => { setKind(k.id); if (file) runPreview(file, k.id); }} className={`rounded-md px-3 py-2 ${kind === k.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500"}`}>
              {k.label}
            </button>
          ))}
        </div>
        <a href={`/api/admin/templates/${tmpl}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline">
          <Download className="h-4 w-4" /> Sample file
        </a>
      </div>

      {!file && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={`mt-5 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-navy-500 bg-navy-50" : "border-slate-300 hover:border-navy-300 hover:bg-slate-50"}`}
        >
          <UploadCloud className="h-10 w-10 text-navy-500" />
          <span className="mt-3 font-semibold text-navy-900">Drop the BUSY export here, or click to choose</span>
          <span className="mt-1 text-sm text-slate-500">.xlsx or .csv, up to 10 MB · one row per invoice line</span>
          <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}

      {file && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-900">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          {!busy && (
            <button onClick={reset} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600" aria-label="Remove file">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {stage === "previewing" && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Spinner /> Checking columns…</p>}

      <div className="mt-4"><FormError>{error}</FormError></div>

      {preview && !result && (
        <div className="mt-4 space-y-4">
          {preview.ok ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">All required columns found</span>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">{preview.lines} lines</span>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">{preview.documents} {kind === "INVOICE" ? "invoices" : "credit notes"}</span>
                {preview.linesWithIssues > 0 && <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">{preview.linesWithIssues} lines will go to exceptions</span>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>{["Row", "Document", "Site", "Cat.", "Item", "Qty", "Taxable ₹", "Issues"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.sample.map((l) => (
                      <tr key={l.row} className={l.issues.length ? "bg-amber-50/60" : ""}>
                        <td className="px-3 py-2">{l.row}</td>
                        <td className="px-3 py-2 font-medium">{l.document}</td>
                        <td className="px-3 py-2">{l.siteCode || "—"}</td>
                        <td className="px-3 py-2">{l.category ?? "—"}</td>
                        <td className="max-w-[12rem] truncate px-3 py-2">{l.item}</td>
                        <td className="px-3 py-2">{l.quantity ?? "—"} {l.unit}</td>
                        <td className="px-3 py-2">{l.taxableValue ?? "—"}</td>
                        <td className="px-3 py-2 text-amber-700">{l.issues.join(", ").replace(/_/g, " ").toLowerCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.lines > preview.sample.length && <p className="text-xs text-slate-500">Showing the first {preview.sample.length} lines.</p>}
            </>
          ) : (
            <FormError>{preview.error}. The whole file will be rejected — fix the export in BUSY and try again.</FormError>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={process} disabled={busy || !preview.ok} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              Process file
            </button>
            <span className="text-xs text-slate-500">Invoices already processed are skipped automatically.</span>
          </div>
        </div>
      )}

      {(stage === "uploading" || stage === "processing") && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm text-navy-900">
            <span className="flex items-center gap-2"><Spinner /> {stage === "uploading" ? `Uploading… ${progress}%` : "Processing lines and calculating points…"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full bg-navy-600 transition-all ${stage === "processing" ? "animate-pulse" : ""}`} style={{ width: `${stage === "processing" ? 100 : progress}%` }} />
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-3">
          {result.rejected ? (
            <FormError>
              File rejected: {result.error}
              {result.missing?.length ? ` Missing: ${result.missing.join(", ")}.` : ""}
            </FormError>
          ) : (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Upload processed</p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                <span>Lines read: <b>{result.summary.linesRead}</b></span>
                <span>Processed: <b>{result.summary.documentsProcessed}</b></span>
                <span>Duplicates skipped: <b>{result.summary.documentsSkipped}</b></span>
                <span>Exceptions: <b>{result.summary.linesException}</b></span>
                <span>WALK-IN ignored: <b>{result.summary.linesIgnored}</b></span>
                {kind === "INVOICE" ? <span>Points credited: <b>{result.summary.pointsCredited}</b></span> : <span>Points reversed: <b>{result.summary.pointsReversed}</b></span>}
              </div>
              {result.summary.failures?.length > 0 && (
                <p className="mt-3 flex items-start gap-2 text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4" /> {result.summary.failures.length} document(s) failed and were not saved. Open the upload for details.</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/uploads/${result.batchId}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy-800 hover:bg-slate-50">View full summary</Link>
            {!result.rejected && result.summary.linesException > 0 && (
              <Link href="/admin/exceptions" className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">Resolve {result.summary.linesException} exceptions</Link>
            )}
            <button onClick={reset} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Upload another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
