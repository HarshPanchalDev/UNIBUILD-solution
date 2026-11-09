import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { mergeSites } from "@/lib/loyalty/sites";

const schema = z.object({ codeA: z.string().trim().min(3).max(20), codeB: z.string().trim().min(3).max(20), reason: z.string().trim().min(3, "Enter a reason").max(500) });

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "sites.manage" });
  const body = await readJson(req, schema);
  const res = await mergeSites(repo, { ...body, userId: s.user.id, ip: await clientIp() });
  return { ok: true, survivor: res.survivor.code, survivorId: res.survivor.id, merged: res.merged };
});
