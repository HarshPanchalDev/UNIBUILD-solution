import { ScrollText } from "lucide-react";
import { Card, PageHeader, Table, td, Pagination, EmptyState, pageParams, inputClass } from "@/components/ui";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDateTime, q } from "@/lib/server/format";

export const metadata = { title: "Audit log · UNIBUILD Admin" };

const ENTITY_TYPES = ["SiteLink", "Settings", "Partner", "UploadBatch", "UploadException", "Redemption", "Site", "SiteLinkRequest", "Reward", "User", "Report", "System"];

function Diff({ before, after }) {
  if (!before && !after) return null;
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => typeof (after?.[k] ?? before?.[k]) !== "object" || (after?.[k] ?? before?.[k]) === null);
  const objKeys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !keys.includes(k));
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-navy-600">Details</summary>
      <dl className="mt-1 space-y-0.5">
        {keys.map((k) => (
          <div key={k} className="flex flex-wrap gap-1">
            <dt className="text-slate-500">{k}:</dt>
            <dd>
              {before && k in before && <span className="text-rose-600 line-through">{String(before[k])}</span>} {after && k in after && <span className="text-emerald-700">{String(after[k])}</span>}
            </dd>
          </div>
        ))}
        {objKeys.length > 0 && <pre className="mt-1 max-h-48 max-w-xl overflow-auto rounded bg-slate-50 p-2 text-[11px]">{JSON.stringify(Object.fromEntries(objKeys.map((k) => [k, { before: before?.[k], after: after?.[k] }])), null, 1)}</pre>}
      </dl>
    </details>
  );
}

export default async function AuditLogPage({ searchParams }) {
  await requireStaffPage("audit.view");
  const sp = await searchParams;
  const entity = ENTITY_TYPES.includes(q(sp.entity)) ? q(sp.entity) : "";
  const action = q(sp.action).trim().toUpperCase().replace(/[^A-Z_]/g, "").slice(0, 40);
  const entityId = q(sp.id).trim().slice(0, 40);
  const { page, pageSize, skip, take } = pageParams(sp, 50);
  const where = { ...(entity ? { entityType: entity } : {}), ...(action ? { action: { contains: action } } : {}), ...(entityId ? { entityId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, skip, take, include: { user: { select: { name: true, role: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every upload, approval, link change, setting change, adjustment and redemption, with user, time and reason. Entries cannot be edited or deleted." />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <select name="entity" defaultValue={entity} className={`${inputClass} max-w-[16rem]`} aria-label="Entity">
          <option value="">All records</option>
          {ENTITY_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input name="action" defaultValue={action} placeholder="Action, e.g. LINK" className={`${inputClass} w-44`} aria-label="Action" />
        <input name="id" defaultValue={entityId} placeholder="Record id" className={`${inputClass} w-32`} aria-label="Record id" />
        <button className="rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No entries" />
        ) : (
          <Table head={["When", "User", "Action", "Record", "Reason", "Changes"]} minWidth={980}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap text-slate-600`}>{fmtDateTime(r.createdAt)}</td>
                <td className={td}>{r.user?.name ?? "System"}{r.user && <p className="text-xs text-slate-400">{r.user.role.replace("_", " ").toLowerCase()}</p>}</td>
                <td className={`${td} font-medium text-navy-900`}>{r.action.replace(/_/g, " ").toLowerCase()}</td>
                <td className={`${td} text-slate-600`}>{r.entityType}{r.entityId ? ` #${r.entityId}` : ""}</td>
                <td className={`${td} max-w-[16rem] text-slate-700`}>{r.reason ?? "—"}</td>
                <td className={td}><Diff before={r.before} after={r.after} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/audit-log" params={{ ...(entity ? { entity } : {}), ...(action ? { action } : {}), ...(entityId ? { id: entityId } : {}) }} />
      </Card>
    </>
  );
}
