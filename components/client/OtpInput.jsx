"use client";

import { useEffect, useRef } from "react";

/** Six boxes; supports paste and Android SMS autofill (autocomplete="one-time-code"). */
export default function OtpInput({ value, onChange, autoFocus = true, label = "Code" }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function set(i, v) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      onChange(clean.slice(0, 6));
      refs.current[Math.min(clean.length, 6) - 1]?.focus();
      return;
    }
    const next = digits.slice();
    next[i] = clean;
    onChange(next.join("").slice(0, 6));
    if (clean && i < 5) refs.current[i + 1]?.focus();
  }

  return (
    <div className="flex gap-2 sm:gap-3" role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => e.key === "Backspace" && !digits[i] && i > 0 && refs.current[i - 1]?.focus()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? 6 : 1}
          aria-label={`${label} ${i + 1}`}
          className="h-12 w-11 rounded-lg border border-slate-300 text-center text-lg font-semibold text-navy-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100 sm:w-12"
        />
      ))}
    </div>
  );
}
