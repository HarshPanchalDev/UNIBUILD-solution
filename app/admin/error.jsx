"use client";

import { AlertTriangle } from "lucide-react";

export default function AdminError({ error, reset }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
      <h1 className="mt-3 font-display text-lg font-semibold text-navy-900">This page could not load</h1>
      <p className="mt-1 text-sm text-slate-500">Please try again. If it keeps happening, check that the database is running.{error?.digest ? ` (ref ${error.digest})` : ""}</p>
      <button onClick={reset} className="mt-5 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">Try again</button>
    </div>
  );
}
