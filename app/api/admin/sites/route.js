import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { createSite } from "@/lib/loyalty/sites";

const siteSchema = z.object({
  code: z.string().trim().max(20).optional().default(""),
  areaPrefix: z.string().trim().max(5).optional().default(""),
  displayName: z.string().trim().max(120).optional().default(""),
  ownerName: z.string().trim().max(120),
  phones: z.array(z.string().trim().max(20)).max(10),
  colony: z.string().trim().max(120),
  address: z.string().trim().max(255).optional().default(""),
  mapsUrl: z.string().trim().max(500).optional().default(""),
  source: z.enum(["COUNTER", "FIELD_SURVEY", "PARTNER_REQUEST", "ADMIN"]).optional().default("ADMIN"),
  confirmDuplicates: z.boolean().optional().default(false),
});

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "sites.manage" });
  const body = await readJson(req, siteSchema);
  const { site, duplicates } = await createSite(repo, { ...body, code: body.code || undefined }, { userId: s.user.id, ip: await clientIp() });
  return { ok: true, id: site.id, code: site.code, duplicates };
});
