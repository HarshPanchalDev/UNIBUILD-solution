import { Download, BarChart3 } from "lucide-react";
import { Card, PageHeader, LinkTabs, Table, td, EmptyState, inputClass } from "@/components/ui";
import { requireStaffPage } from "@/lib/server/auth";
import { runReport, REPORTS } from "@/lib/server/reports";
import { q } from "@/lib/server/format";

export const metadata = { title: "Reports · UNIBUILD Admin" };

const fmtCell = (c, v) => (c.money ? `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : c.num ? Number(v).toLocaleString("en-IN") : v);

export default async function ReportsPage({ searchParams }) {
  const s = await requireStaffPage("reports.view");
  const sp = await searchParams;
  const name = REPORTS[q(sp.tab)] ? q(sp.tab) : "points";
  let data;
  let error = null;
  try {
    data = await runReport(name, { from: q(sp.from), to: q(sp.to) });
  } catch (e) {
    error = e.message;
    data = await runReport(name, {});
  }
  const exportUrl = `/api/admin/reports/${name}?from=${data.range.from}&to=${data.range.to}&format=xlsx`;
  const numericCols = data.columns.filter((c) => c.num && c.key !== "rank" && c.key !== "share");
  const totals = Object.fromEntries(numericCols.map((c) => [c.key, data.rows.reduce((a, r) => a + Number(r[c.key] || 0), 0)]));
  const showTotals = ["points", "linked-share", "reward-costs", "activity"].includes(name) && data.rows.length > 1;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={s.user.role === "OWNER" ? "All figures come from the ledger and uploaded invoices." : "Read-only for Store Managers."}
        action={
          <a href={exportUrl} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
            <Download className="h-4 w-4" /> Export Excel
          </a>
        }
      />
      <LinkTabs basePath="/admin/reports" active={name} params={{ from: data.range.from, to: data.range.to }} tabs={Object.entries(REPORTS).map(([key, label]) => ({ key, label }))} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={name} />
        <label className="text-sm"><span className="mb-1 block text-slate-500">From</span><input type="date" name="from" defaultValue={data.range.from} className={inputClass} /></label>
        <label className="text-sm"><span className="mb-1 block text-slate-500">To</span><input type="date" name="to" defaultValue={data.range.to} className={inputClass} /></label>
        <button className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white">Apply</button>
      </form>
      {error && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{error} Showing the default range.</p>}
      <Card className="overflow-hidden">
        <p className="px-5 pt-5 font-semibold text-navy-900">{data.title} <span className="text-sm font-normal text-slate-500">· {data.range.from} to {data.range.to}</span></p>
        <div className="mt-3">
          {data.rows.length === 0 ? (
            <EmptyState icon={BarChart3} title="No data in this range" />
          ) : (
            <Table head={data.columns.map((c) => ({ label: c.header, right: c.num }))} minWidth={Math.max(560, data.columns.length * 130)}>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {data.columns.map((c) => (
                    <td key={c.key} className={`${td} ${c.num ? "text-right tabular-nums" : ""} ${c.key === "code" || c.key === "month" ? "font-medium text-navy-900" : "text-slate-700"}`}>{fmtCell(c, r[c.key])}</td>
                  ))}
                </tr>
              ))}
              {showTotals && (
                <tr className="bg-slate-50 font-semibold">
                  {data.columns.map((c, i) => (
                    <td key={c.key} className={`${td} ${c.num ? "text-right tabular-nums" : ""}`}>{i === 0 ? "Total" : totals[c.key] !== undefined ? fmtCell(c, totals[c.key]) : ""}</td>
                  ))}
                </tr>
              )}
            </Table>
          )}
        </div>
      </Card>
    </>
  );
}
