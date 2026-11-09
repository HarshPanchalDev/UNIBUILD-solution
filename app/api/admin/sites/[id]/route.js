import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { updateSite } from "@/lib/loyalty/sites";

const schema = z.object({
  displayName: z.string().trim().max(120).optional(),
  ownerName: z.string().trim().max(120),
  phones: z.array(z.string().trim().max(20)).max(10),
  colony: z.string().trim().max(120),
  address: z.string().trim().max(255).optional().default(""),
  mapsUrl: z.string().trim().max(500).optional().default(""),
  isIncomplete: z.boolean().optional(),
  confirmDuplicates: z.boolean().optional().default(false),
});

export const PATCH = api(async (req, { id }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "sites.manage" });
  const body = await readJson(req, schema);
  const site = await updateSite(repo, idParam(id), body, { userId: s.user.id, ip: await clientIp() });
  return { ok: true, code: site.code };
});
