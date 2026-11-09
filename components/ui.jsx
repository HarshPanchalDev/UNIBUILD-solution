import Link from "next/link";
import { Inbox, ChevronLeft, ChevronRight } from "lucide-react";

// Shared building blocks (server-safe: no hooks). Theme tokens live in app/globals.css.

const badgeColors = {
  LOCKED: "bg-amber-50 text-amber-700 ring-amber-200",
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CREDITED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REDEEMED: "bg-navy-50 text-navy-700 ring-navy-200",
  REVERSED: "bg-rose-50 text-rose-700 ring-rose-200",
  EXPIRED: "bg-slate-100 text-slate-500 ring-slate-200",
  ADJUSTED: "bg-violet-50 text-violet-700 ring-violet-200",
  REQUESTED: "bg-sky-50 text-sky-700 ring-sky-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  READY: "bg-amber-50 text-amber-700 ring-amber-200",
  COLLECTED: "bg-navy-50 text-navy-700 ring-navy-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  PROCESSED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-600 ring-slate-200",
  MERGED: "bg-slate-100 text-slate-500 ring-slate-200",
  ENDED: "bg-slate-100 text-slate-600 ring-slate-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-200",
  OPEN: "bg-rose-50 text-rose-700 ring-rose-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DISMISSED: "bg-slate-100 text-slate-500 ring-slate-200",
  INACTIVE: "bg-slate-100 text-slate-500 ring-slate-200",
  RETIRED: "bg-slate-100 text-slate-400 ring-slate-200",
  NO_PARTNER: "bg-slate-100 text-slate-600 ring-slate-200",
  WALK_IN: "bg-slate-100 text-slate-500 ring-slate-200",
  EXCEPTION: "bg-rose-50 text-rose-700 ring-rose-200",
  SAATHI: "bg-sky-50 text-sky-700 ring-sky-200",
  SILVER: "bg-slate-100 text-slate-700 ring-slate-300",
  GOLD: "bg-brand-50 text-brand-600 ring-brand-300",
};

export function Badge({ children, tone }) {
  const key = tone ?? (typeof children === "string" ? children.toUpperCase().replace(/ /g, "_") : "");
  const cls = badgeColors[key] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}

export const titleCase = (s) => String(s ?? "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function StatusBadge({ status }) {
  return <Badge tone={status}>{titleCase(status)}</Badge>;
}

export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,31,58,0.04)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, iconClass = "text-brand-500", value, label, hint, href }) {
  const body = (
    <>
      <Icon className={`h-6 w-6 ${iconClass}`} strokeWidth={2} />
      <div className="mt-3 font-display text-2xl font-bold text-navy-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
      {hint && <div className="mt-1.5 text-xs text-slate-400">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,31,58,0.04)] transition hover:border-navy-200 hover:shadow-md">
      {body}
    </Link>
  ) : (
    <Card className="p-5">{body}</Card>
  );
}

export function Button({ as: Comp = "button", variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-navy-800 text-white hover:bg-navy-700 disabled:bg-slate-300",
    brand: "bg-brand-500 text-navy-900 hover:bg-brand-400 disabled:bg-slate-300",
    outline: "border border-slate-300 bg-white text-navy-800 hover:bg-slate-50",
    ghost: "text-navy-700 hover:bg-navy-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <Comp
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint, optional }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-900">
        {label} {optional && <span className="font-normal text-slate-400">({optional})</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100 disabled:bg-slate-50";

export function formatPts(n) {
  return Number(n ?? 0).toLocaleString("en-IN");
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-400">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-3 font-semibold text-navy-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Link-based tabs that keep other query params. */
export function LinkTabs({ tabs, active, basePath, params = {} }) {
  return (
    <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
      {tabs.map((t) => {
        const q = new URLSearchParams({ ...params, tab: t.key });
        q.delete("page");
        const on = active === t.key;
        return (
          <Link
            key={t.key}
            href={`${basePath}?${q}`}
            role="tab"
            aria-selected={on}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${on ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label}
            {t.count !== undefined && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-slate-100"}`}>{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Pagination({ page, pageSize, total, basePath, params = {} }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return total ? <p className="px-5 py-3 text-xs text-slate-500">{total} result{total === 1 ? "" : "s"}</p> : null;
  const href = (p) => {
    const q = new URLSearchParams({ ...params, page: String(p) });
    return `${basePath}?${q}`;
  };
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
      <span className="text-slate-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 p-1.5 text-slate-300"><ChevronLeft className="h-4 w-4" /></span>
        )}
        <span className="px-2 py-1.5 text-slate-600">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 p-1.5 text-slate-300"><ChevronRight className="h-4 w-4" /></span>
        )}
      </div>
    </div>
  );
}

/** Simple GET search/filter form (works without JavaScript). */
export function FilterBar({ basePath, params = {}, children }) {
  return (
    <form action={basePath} method="get" className="mb-4 flex flex-wrap items-end gap-2">
      {params.tab && <input type="hidden" name="tab" value={params.tab} />}
      {children}
      <button type="submit" className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
        Apply
      </button>
    </form>
  );
}

export function Table({ head, children, minWidth = 640 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-slate-50">
          <tr className="text-left text-xs text-slate-500">
            {head.map((h, i) => (
              <th key={i} className={`px-4 py-3 font-medium ${h.right ? "text-right" : ""}`}>
                {h.label ?? h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-4 py-3 align-top";

export function pageParams(searchParams, pageSize = 25) {
  const page = Math.max(1, Math.min(10000, Number(searchParams?.page) || 1));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
