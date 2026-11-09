"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Pencil } from "lucide-react";
import { Modal, callApi, useToast, Spinner, FormError, FieldError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

export default function StaffForm({ user = null }) {
  const editing = Boolean(user);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(user ? { ...user, mobile: user.mobile ?? "", password: "" } : { name: "", email: "", mobile: "", role: "STORE_MANAGER", password: "", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fe, setFe] = useState({});
  const toast = useToast();
  const router = useRouter();
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFe({});
    try {
      if (editing) await callApi(`/api/admin/staff/${user.id}`, { method: "PATCH", body: { name: v.name, email: v.email, mobile: v.mobile, role: v.role, isActive: v.isActive, password: v.password } });
      else await callApi("/api/admin/staff", { body: { name: v.name, email: v.email, mobile: v.mobile, role: v.role, password: v.password } });
      toast(editing ? "Account updated" : "Account created");
      setOpen(false);
      router.refresh();
    } catch (ex) {
      setError(ex.message);
      if (ex.details) setFe(ex.details);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={editing ? "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-navy-800 hover:bg-slate-50" : "inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"}>
        {editing ? <Pencil className="h-3.5 w-3.5" /> : <UserPlus className="h-4 w-4" />} {editing ? "Edit" : "Add staff account"}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? `Edit ${user.name}` : "New staff account"}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-navy-900">Name</span><input className={inputClass} value={v.name} onChange={set("name")} /><FieldError>{fe.name}</FieldError></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-navy-900">Email (used to sign in)</span><input className={inputClass} type="email" value={v.email} onChange={set("email")} /><FieldError>{fe.email}</FieldError></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-navy-900">Mobile <span className="font-normal text-slate-400">(needed for the sign-in code if enabled)</span></span><input className={inputClass} value={v.mobile} onChange={set("mobile")} inputMode="numeric" /><FieldError>{fe.mobile}</FieldError></label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Role</span>
            <select className={inputClass} value={v.role} onChange={set("role")}>
              <option value="STORE_MANAGER">Store Manager — uploads, sites, partners, links, redemptions; reports read-only</option>
              <option value="OWNER">Owner — everything, incl. settings, rewards, staff, adjustments, audit log</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">{editing ? "New password (leave empty to keep)" : "Password"}</span>
            <input className={inputClass} type="password" autoComplete="new-password" value={v.password} onChange={set("password")} />
            <span className="mt-1 block text-xs text-slate-500">At least 10 characters with letters and numbers.</span>
            <FieldError>{fe.password}</FieldError>
          </label>
          {editing && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-navy-800" checked={v.isActive} onChange={set("isActive")} /> Account active (unticking signs them out everywhere)</label>
          )}
          <FormError>{error}</FormError>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <Spinner />} Save</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
