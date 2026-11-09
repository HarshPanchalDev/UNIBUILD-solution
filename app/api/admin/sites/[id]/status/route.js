import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { setSiteStatus } from "@/lib/loyalty/sites";

const schema = z.object({ status: z.enum(["ACTIVE", "COMPLETED"]), reason: z.string().trim().max(500).optional().default("") });

export const POST = api(async (req, { id }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "sites.manage" });
  const { status, reason } = await readJson(req, schema);
  await setSiteStatus(repo, idParam(id), status, { userId: s.user.id, reason: reason || null, ip: await clientIp() });
  return { ok: true };
});
