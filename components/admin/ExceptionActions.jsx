"use client";

import Link from "next/link";
import { RefreshCw, XCircle, Plus } from "lucide-react";
import ActionDialog from "@/components/client/ActionDialog";

const CATEGORY_OPTIONS = [
  { value: "1", label: "1 · Cement" },
  { value: "2", label: "2 · Waterproofing & Hardware" },
  { value: "3", label: "3 · Plumbing" },
  { value: "4", label: "4 · Electrical" },
  { value: "5", label: "5 · Paint" },
];

export default function ExceptionActions({ ex }) {
  const needsSite = ex.reason === "MISSING_SITE_CODE" || ex.reason === "UNKNOWN_SITE_CODE";
  const needsCategory = ex.reason === "MISSING_CATEGORY" || ex.reason === "INVALID_CATEGORY";
  const canReprocess = ex.hasLine && ex.reason !== "INVALID_VALUE" && ex.reason !== "INVALID_DATE";
  const fields = [];
  if (ex.kind === "INVOICE") fields.push({ name: "siteCode", label: "Site Code", defaultValue: ex.siteCode ?? "", placeholder: "e.g. SAL-0012 or WALK-IN", hint: needsSite ? "Correct the code, or create the site first. Type WALK-IN if it had no site." : "Leave as it is unless it was wrong.", required: ex.kind === "INVOICE" });
  fields.push({ name: "category", label: "Category", type: "select", options: CATEGORY_OPTIONS, defaultValue: ex.category ? String(ex.category) : "", required: true, hint: needsCategory ? "The category in the file was missing or not 1–5." : undefined });

  return (
    <div className="flex flex-wrap gap-2">
      {canReprocess && (
        <ActionDialog
          label="Fix & re-process"
          icon={RefreshCw}
          title={`Re-process row ${ex.rowNumber} of ${ex.documentNumber}`}
          description="Points are calculated with the rates of the original upload. Once processed, this exception closes and can't earn twice."
          endpoint={`/api/admin/exceptions/${ex.id}/reprocess`}
          fields={fields}
          confirmLabel="Re-process"
          successMessage={(r) => `Re-processed: ${r.outcome.status.replace(/_/g, " ").toLowerCase()}${r.outcome.points ? `, ${r.outcome.points} points to ${r.outcome.partnerCode ?? "partner"}` : ""}`}
          buttonClass="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        />
      )}
      {ex.reason === "UNKNOWN_SITE_CODE" && (
        <Link href={`/admin/sites?new=${encodeURIComponent(ex.siteCode ?? "")}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-navy-800 hover:bg-slate-50">
          <Plus className="h-4 w-4" /> Create site {ex.siteCode}
        </Link>
      )}
      <ActionDialog
        label="Dismiss"
        icon={XCircle}
        danger
        title="Dismiss this exception?"
        description="The line will never earn points. Use this only for test data or lines that should not count."
        endpoint={`/api/admin/exceptions/${ex.id}/dismiss`}
        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
        confirmLabel="Dismiss"
        successMessage="Exception dismissed"
      />
    </div>
  );
}
