"use client";

import { Check, PackageCheck, HandHeart, X } from "lucide-react";
import ActionDialog from "@/components/client/ActionDialog";

const btn = "inline-flex items-center gap-1 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700";

export default function RedemptionActions({ r }) {
  const base = `/api/admin/redemptions/${r.id}`;
  const next = {
    REQUESTED: { step: "approve", label: "Approve", icon: Check, text: `Approve ${r.rewardName} for ${r.partnerCode}? The points were already taken when the request was made.` },
    APPROVED: { step: "ready", label: "Mark ready", icon: PackageCheck, text: "The partner will be told the reward is ready for pickup at the counter." },
    READY: { step: "collect", label: "Mark collected", icon: HandHeart, text: "Confirm the partner has collected the reward." },
  }[r.status];
  return (
    <div className="flex flex-wrap gap-1.5">
      {next && (
        <ActionDialog label={next.label} icon={next.icon} buttonClass={btn} title={`${next.label} · ${r.number}`} description={next.text} endpoint={`${base}/${next.step}`} fields={[]} confirmLabel={next.label} successMessage={`${r.number}: ${next.label.toLowerCase()}`} />
      )}
      {["REQUESTED", "APPROVED"].includes(r.status) && (
        <ActionDialog
          label="Reject"
          icon={X}
          danger
          buttonClass="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          title={`Reject ${r.number}?`}
          description={`${r.points} points go back to ${r.partnerCode}'s balance. The partner sees the reason.`}
          endpoint={`${base}/reject`}
          fields={[{ name: "reason", label: "Rejection reason", type: "textarea", required: true }]}
          confirmLabel="Reject"
          successMessage="Redemption rejected and points returned"
        />
      )}
    </div>
  );
}
