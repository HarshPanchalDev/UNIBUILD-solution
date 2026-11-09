import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { advanceRedemption, rejectRedemption } from "@/lib/loyalty/redemptions";

const rejectSchema = z.object({ reason: z.string().trim().min(3, "Enter the rejection reason").max(500) });

export const POST = api(async (req, { id, action }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "redemptions.manage" });
  const redemptionId = idParam(id);
  const ctx = { redemptionId, userId: s.user.id, ip: await clientIp() };
  if (action === "reject") {
    const r = await rejectRedemption(repo, { ...ctx, ...(await readJson(req, rejectSchema)) });
    return { ok: true, status: r.status };
  }
  const r = await advanceRedemption(repo, { ...ctx, step: action });
  return { ok: true, status: r.status };
});
