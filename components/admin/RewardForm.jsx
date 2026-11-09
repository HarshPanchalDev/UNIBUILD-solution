"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Modal, callApi, useToast, Spinner, FormError } from "@/components/client/feedback";
import { inputClass } from "@/components/ui";

const blank = { name: "", description: "", section: "Vouchers", points: "", status: "ACTIVE", sortOrder: "0" };

export default function RewardForm({ reward = null }) {
  const editing = Boolean(reward);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(reward ? { ...blank, ...reward, points: String(reward.points), sortOrder: String(reward.sortOrder) } : blank);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(reward?.imageUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData();
    for (const k of ["name", "description", "section", "points", "status", "sortOrder"]) form.set(k, v[k] ?? "");
    if (image) form.set("image", image);
    try {
      await callApi(editing ? `/api/admin/rewards/${reward.id}` : "/api/admin/rewards", { method: editing ? "PATCH" : "POST", form });
      toast(editing ? "Reward updated" : "Reward added");
      setOpen(false);
      if (!editing) {
        setV(blank);
        setImage(null);
        setPreview(null);
      }
      router.refresh();
    } catch (err) {
      setError(err.message + (err.details ? ` (${Object.values(err.details).join(", ")})` : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={editing ? "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-navy-800 hover:bg-slate-50" : "inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"}>
        {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />} {editing ? "Edit" : "Add reward"}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? `Edit ${reward.name}` : "Add reward"}>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Name</span>
            <input className={inputClass} value={v.name} onChange={set("name")} required maxLength={120} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Description <span className="font-normal text-slate-400">(optional)</span></span>
            <textarea className={`${inputClass} min-h-20`} value={v.description ?? ""} onChange={set("description")} maxLength={500} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Points needed</span>
              <input className={inputClass} type="number" min="1" value={v.points} onChange={set("points")} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Group</span>
              <input className={inputClass} value={v.section} onChange={set("section")} list="reward-groups" />
              <datalist id="reward-groups"><option value="Vouchers" /><option value="Tools & Equipment" /><option value="Merchandise" /></datalist>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Status</span>
              <select className={inputClass} value={v.status} onChange={set("status")}>
                <option value="ACTIVE">Active (partners can redeem)</option>
                <option value="INACTIVE">Inactive (hidden for now)</option>
                <option value="RETIRED">Retired (permanently hidden)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Sort order</span>
              <input className={inputClass} type="number" min="0" value={v.sortOrder} onChange={set("sortOrder")} />
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-navy-900">Image <span className="font-normal text-slate-400">(JPG/PNG/WebP, max 2 MB)</span></span>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:text-navy-800"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setImage(f ?? null);
                  if (f) setPreview(URL.createObjectURL(f));
                }}
              />
            </div>
          </div>
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
