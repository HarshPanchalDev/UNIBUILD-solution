import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { createLink } from "@/lib/loyalty/links";
import { getActiveSettings } from "@/lib/loyalty/settingsService";

const schema = z.object({
  siteId: z.number().int().positive(),
  partnerId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().trim().min(3, "Enter how you confirmed who works on this site").max(500),
});

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "links.manage" });
  const body = await readJson(req, schema);
  const link = await createLink(repo, { ...body, userId: s.user.id, ip: await clientIp(), settings: await getActiveSettings(repo) });
  return { ok: true, id: link.id };
});
