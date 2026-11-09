"use client";

export default function RootError({ error, reset }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <h1 className="font-display text-xl font-bold text-navy-900">कुछ गड़बड़ हुई · Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">Please try again in a moment.{error?.digest ? ` (ref ${error.digest})` : ""}</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white">फिर से कोशिश करें · Try again</button>
    </div>
  );
}
