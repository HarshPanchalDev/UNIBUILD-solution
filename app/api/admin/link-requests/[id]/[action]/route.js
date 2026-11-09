import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { approveLinkRequest, rejectLinkRequest } from "@/lib/loyalty/linkRequests";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { invalid } from "@/lib/loyalty/errors";

const approveSchema = z.object({
  siteCode: z.string().trim().max(20).optional().default(""),
  areaPrefix: z.string().trim().max(5).optional().default(""),
  confirmDuplicates: z.boolean().optional().default(false),
  reason: z.string().trim().min(3, "Enter how you verified this").max(500),
});
const rejectSchema = z.object({ reason: z.string().trim().min(3, "Enter a reason").max(500) });

export const POST = api(async (req, { id, action }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "links.manage" });
  const requestId = idParam(id);
  const ctx = { requestId, userId: s.user.id, ip: await clientIp() };
  if (action === "approve") {
    const body = await readJson(req, approveSchema);
    await approveLinkRequest(repo, { ...ctx, ...body, siteCode: body.siteCode || undefined, areaPrefix: body.areaPrefix || undefined, settings: await getActiveSettings(repo) });
    return { ok: true };
  }
  if (action === "reject") {
    await rejectLinkRequest(repo, { ...ctx, ...(await readJson(req, rejectSchema)) });
    return { ok: true };
  }
  throw invalid("Unknown action");
});
