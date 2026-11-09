import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { reprocessException, dismissException } from "@/lib/loyalty/exceptions";
import { invalid } from "@/lib/loyalty/errors";

const reprocessSchema = z.object({ siteCode: z.string().trim().max(20).optional(), category: z.union([z.string(), z.number()]).optional() });
const dismissSchema = z.object({ reason: z.string().trim().min(3, "Enter a reason").max(500) });

export const POST = api(async (req, { id, action }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "exceptions.manage" });
  const exceptionId = idParam(id);
  const ip = await clientIp();
  if (action === "reprocess") {
    const fix = await readJson(req, reprocessSchema);
    const outcome = await reprocessException(repo, { exceptionId, fix: { siteCode: fix.siteCode || undefined, category: fix.category === undefined || fix.category === "" ? undefined : String(fix.category) }, userId: s.user.id, ip });
    return { ok: true, outcome };
  }
  if (action === "dismiss") {
    const { reason } = await readJson(req, dismissSchema);
    return { ok: true, outcome: await dismissException(repo, { exceptionId, reason, userId: s.user.id, ip }) };
  }
  throw invalid("Unknown action");
});
