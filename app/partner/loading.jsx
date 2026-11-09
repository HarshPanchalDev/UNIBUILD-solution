export default function PartnerLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-lg bg-slate-200" />
      <div className="h-28 rounded-2xl bg-brand-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-slate-200/70" />
        <div className="h-20 rounded-2xl bg-slate-200/70" />
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/70" />
    </div>
  );
}
