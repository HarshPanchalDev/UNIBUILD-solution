import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rateLimit";
import { createLinkRequest } from "@/lib/loyalty/linkRequests";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("EXISTING_SITE"), siteCode: z.string().trim().min(3).max(20) }),
  z.object({
    type: z.literal("NEW_SITE"),
    ownerName: z.string().trim().max(120),
    phone: z.string().trim().max(15),
    colony: z.string().trim().max(120),
    mapsUrl: z.string().trim().max(500).optional().default(""),
  }),
]);

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "PARTNER" });
  await rateLimit(`link-request:${s.partner.id}`, 20, 24 * 3600);
  const input = await readJson(req, schema);
  const r = await createLinkRequest(repo, { partnerId: s.partner.id, input });
  return { ok: true, id: r.id };
});
