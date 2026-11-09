"use client";

import { Check, X, Ban, RotateCcw, Award, PlusCircle } from "lucide-react";
import ActionDialog from "@/components/client/ActionDialog";

const primary = "inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700";

export default function PartnerActions({ partner, isOwner, compact = false }) {
  const base = `/api/admin/partners/${partner.id}`;
  const sm = compact ? "inline-flex items-center gap-1 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700" : primary;
  return (
    <div className="flex flex-wrap gap-2">
      {partner.status === "PENDING" && (
        <>
          <ActionDialog
            label="Approve"
            icon={Check}
            buttonClass={sm}
            title={`Approve ${partner.name}?`}
            description={`A permanent Partner Code (UBP-${{ CONTRACTOR: "CO", PLUMBER: "PL", ELECTRICIAN: "EL", PAINTER: "PA" }[partner.trade]}-####) will be issued. Check the person and trade before approving.`}
            endpoint={`${base}/approve`}
            fields={[]}
            confirmLabel="Approve"
            successMessage={(r) => `Approved — code ${r.partner.code}`}
          />
          <ActionDialog
            label="Reject"
            icon={X}
            danger
            buttonClass={compact ? "inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50" : undefined}
            title={`Reject ${partner.name}?`}
            description="The partner sees this reason."
            endpoint={`${base}/reject`}
            fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
            confirmLabel="Reject"
            successMessage="Registration rejected"
          />
        </>
      )}
      {!compact && partner.status === "APPROVED" && (
        <ActionDialog
          label="Suspend"
          icon={Ban}
          danger
          title={`Suspend ${partner.code}?`}
          description="A suspended partner earns no new points. Existing points stay but cannot be redeemed until reinstated."
          endpoint={`${base}/suspend`}
          fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
          confirmLabel="Suspend"
          successMessage="Partner suspended"
        />
      )}
      {!compact && partner.status === "SUSPENDED" && (
        <ActionDialog
          label="Reinstate"
          icon={RotateCcw}
          title={`Reinstate ${partner.code}?`}
          endpoint={`${base}/reinstate`}
          fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
          confirmLabel="Reinstate"
          successMessage="Partner reinstated"
        />
      )}
      {!compact && isOwner && ["APPROVED", "SUSPENDED"].includes(partner.status) && (
        <>
          <ActionDialog
            label="Set tier"
            icon={Award}
            title={`Change tier for ${partner.code}`}
            description="Tiers are normally recalculated each quarter. A manual change is logged."
            endpoint={`${base}/tier`}
            fields={[
              { name: "tier", label: "New tier", type: "select", required: true, options: [{ value: "SAATHI", label: "Saathi (1×)" }, { value: "SILVER", label: "Silver" }, { value: "GOLD", label: "Gold" }].filter((o) => o.value !== partner.tier) },
              { name: "reason", label: "Reason", type: "textarea", required: true },
            ]}
            confirmLabel="Change tier"
            successMessage="Tier updated"
          />
          <ActionDialog
            label="Adjust points"
            icon={PlusCircle}
            title={`Manual points adjustment · ${partner.code}`}
            description="Owner only. Use a positive number to add (available immediately) or negative to deduct. The partner sees the reason. The balance can never go below zero."
            endpoint={`${base}/adjust`}
            fields={[
              { name: "points", label: "Points (+ or −)", type: "number", required: true, placeholder: "e.g. 50 or -20" },
              { name: "reason", label: "Reason (shown to partner)", type: "textarea", required: true },
            ]}
            transform={(v) => ({ points: Number(v.points), reason: v.reason })}
            confirmLabel="Save adjustment"
            successMessage="Adjustment recorded"
          />
        </>
      )}
    </div>
  );
}
