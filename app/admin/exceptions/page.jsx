import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, PageHeader, StatusBadge, LinkTabs, Pagination, EmptyState, pageParams, inputClass } from "@/components/ui";
import ExceptionActions from "@/components/admin/ExceptionActions";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDateTime, q } from "@/lib/server/format";

export const metadata = { title: "Exceptions · UNIBUILD Admin" };

const REASONS = {
  MISSING_SITE_CODE: "Site Code missing",
  UNKNOWN_SITE_CODE: "Site Code not in the app",
  MISSING_CATEGORY: "Category missing",
  INVALID_CATEGORY: "Category not 1–5",
  INVALID_VALUE: "Quantity or value not a number",
  INVALID_DATE: "Invoice/payment date invalid",
  UNKNOWN_INVOICE: "Original invoice not found",
};

export default async function ExceptionsPage({ searchParams }) {
  await requireStaffPage("exceptions.manage");
  const sp = await searchParams;
  const tab = ["OPEN", "RESOLVED", "DISMISSED"].includes(q(sp.tab)) ? q(sp.tab) : "OPEN";
  const reason = REASONS[q(sp.reason)] ? q(sp.reason) : "";
  const { page, pageSize, skip, take } = pageParams(sp, 20);
  const where = { status: tab, ...(reason ? { reason } : {}) };
  const [rows, total, counts] = await Promise.all([
    prisma.uploadException.findMany({ where, orderBy: { id: tab === "OPEN" ? "asc" : "desc" }, skip, take, include: { uploadBatch: { select: { fileName: true, createdAt: true } } } }),
    prisma.uploadException.count({ where }),
    prisma.uploadException.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const lineIds = rows.map((r) => r.invoiceLineId).filter(Boolean);
  const creditIds = rows.map((r) => r.creditNoteLineId).filter(Boolean);
  const [lines, creditLines] = await Promise.all([
    prisma.invoiceLine.findMany({ where: { id: { in: lineIds } }, select: { id: true, siteCodeRaw: true, category: true } }),
    prisma.creditNoteLine.findMany({ where: { id: { in: creditIds } }, select: { id: true, siteCodeRaw: true, category: true } }),
  ]);
  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const creditMap = new Map(creditLines.map((l) => [l.id, l]));
  const params = { tab, ...(reason ? { reason } : {}) };

  return (
    <>
      <PageHeader title="Exceptions" subtitle="Lines that failed a check earn nothing until fixed. WALK-IN lines are ignored and never appear here." />
      <LinkTabs
        basePath="/admin/exceptions"
        active={tab}
        params={reason ? { reason } : {}}
        tabs={[
          { key: "OPEN", label: "Open", count: count.OPEN ?? 0 },
          { key: "RESOLVED", label: "Resolved", count: count.RESOLVED ?? 0 },
          { key: "DISMISSED", label: "Dismissed", count: count.DISMISSED ?? 0 },
        ]}
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <select name="reason" defaultValue={reason} className={`${inputClass} max-w-[16rem]`} aria-label="Filter by reason">
          <option value="">All reasons</option>
          {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Filter</button>
      </form>

      {rows.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title={tab === "OPEN" ? "No open exceptions" : "Nothing here"} text={tab === "OPEN" ? "Every uploaded line has been processed." : undefined} /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => {
            const line = e.invoiceLineId ? lineMap.get(e.invoiceLineId) : creditMap.get(e.creditNoteLineId);
            const raw = e.raw ?? {};
            return (
              <Card key={e.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{REASONS[e.reason]}</span>
                      <span className="text-sm font-semibold text-navy-900">{e.kind === "INVOICE" ? "Invoice" : "Credit note"} {e.documentNumber}</span>
                      <span className="text-xs text-slate-500">row {e.rowNumber}</span>
                      {tab !== "OPEN" && <StatusBadge status={e.status} />}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      From <Link className="underline" href={`/admin/uploads/${e.uploadBatchId}`}>{e.uploadBatch.fileName}</Link> · {fmtDateTime(e.uploadBatch.createdAt)}
                      {e.attempts > 0 && ` · ${e.attempts} attempt${e.attempts > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {tab === "OPEN" && (
                    <ExceptionActions ex={{ id: e.id, kind: e.kind, reason: e.reason, rowNumber: e.rowNumber, documentNumber: e.documentNumber, hasLine: Boolean(line), siteCode: line?.siteCodeRaw ?? raw["Site Code"] ?? "", category: line?.category ?? null }} />
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4 lg:grid-cols-5">
                  {Object.entries(raw).map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="truncate font-medium text-navy-900">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {e.reason === "INVALID_DATE" && tab === "OPEN" && <p className="mt-2 text-xs text-slate-500">Fix the dates in BUSY and upload the file again — this closes automatically.</p>}
                {e.reason === "INVALID_VALUE" && tab === "OPEN" && <p className="mt-2 text-xs text-slate-500">Correct the quantity/value in BUSY and re-upload, or dismiss.</p>}
                {(e.resolutionNote || (Array.isArray(e.history) && e.history.length > 0)) && (
                  <details className="mt-2 text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium text-navy-700">Processing history</summary>
                    {e.resolutionNote && <p className="mt-1">{e.resolutionNote} {e.resolvedAt ? `· ${fmtDateTime(e.resolvedAt)}` : ""}</p>}
                    <ul className="mt-1 space-y-0.5">
                      {(e.history ?? []).map((h, i) => (
                        <li key={i}>{fmtDateTime(h.at)} — {h.result}{h.points ? ` (${h.points} pts)` : ""}{h.fix?.siteCode ? ` · code ${h.fix.siteCode}` : ""}{h.reason ? ` · ${h.reason}` : ""}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {total > pageSize && <Card className="mt-4"><Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/exceptions" params={params} /></Card>}
    </>
  );
}
