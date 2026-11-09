"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Spinner } from "./feedback";

export default function LogoutButton({ className = "", label = "Logout", iconClass = "h-4 w-4 text-rose-400" }) {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    const res = await fetch("/api/auth/logout", { method: "POST" }).then((r) => r.json()).catch(() => ({}));
    window.location.href = res.redirect || "/login";
  }
  return (
    <button type="button" onClick={logout} disabled={busy} className={`flex items-center gap-2 ${className}`}>
      {busy ? <Spinner /> : <LogOut className={iconClass} />} {label}
    </button>
  );
}
