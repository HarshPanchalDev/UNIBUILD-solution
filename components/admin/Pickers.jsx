"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { inputClass } from "@/components/ui";
import { Spinner } from "@/components/client/feedback";

const TRADE = { CONTRACTOR: "Contractor", PLUMBER: "Plumber", ELECTRICIAN: "Electrician", PAINTER: "Painter" };

/** Type-ahead search against /api/admin/lookup. value = selected item or null. */
function Picker({ type, value, onChange, placeholder, extraQuery = "", render }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (value || text.trim().length < 2) {
      setItems([]);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/lookup?type=${type}&q=${encodeURIComponent(text.trim())}${extraQuery}`).then((r) => r.json());
        setItems(type === "partner" ? res.partners ?? [] : res.sites ?? []);
        setOpen(true);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [text, type, value, extraQuery]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-navy-200 bg-navy-50 px-3.5 py-2.5 text-sm">
        <span>{render(value)}</span>
        <button type="button" onClick={() => { onChange(null); setText(""); }} className="text-slate-400 hover:text-slate-600" aria-label="Clear"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className={`${inputClass} pl-9`} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder} />
      {busy && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><Spinner /></span>}
      {open && items.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(it); setOpen(false); }}>
                {render(it)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !busy && text.trim().length >= 2 && items.length === 0 && <p className="mt-1 text-xs text-slate-500">No matches</p>}
    </div>
  );
}

export function PartnerPicker({ value, onChange, trade, approvedOnly = true }) {
  return (
    <Picker
      type="partner"
      value={value}
      onChange={onChange}
      placeholder="Search partner by name, code or mobile"
      extraQuery={`${trade ? `&trade=${trade}` : ""}${approvedOnly ? "&approved=1" : ""}`}
      render={(p) => (
        <span>
          <b className="text-navy-900">{p.code ?? "(pending)"}</b> · {p.name} <span className="text-slate-500">· {TRADE[p.trade]} · {p.mobile}</span>
        </span>
      )}
    />
  );
}

export function SitePicker({ value, onChange }) {
  return (
    <Picker
      type="site"
      value={value}
      onChange={onChange}
      placeholder="Search site by code, owner, phone or colony"
      render={(s) => (
        <span>
          <b className="text-navy-900">{s.code}</b> · {s.ownerName} <span className="text-slate-500">· {s.colony}</span>
        </span>
      )}
    />
  );
}
