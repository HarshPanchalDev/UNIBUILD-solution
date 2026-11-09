import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma, repo } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";
import { audit } from "@/lib/loyalty/notify";

const schema = z.object({
  areaServed: z.string().trim().min(2, "Enter the area you serve").max(160),
  whatsappOptIn: z.boolean().optional(),
});

// Partners can edit only their area and photo (spec 10 — Profile).
export const PATCH = api(async (req) => {
  const s = await requireApiUser({ role: "PARTNER" });
  const body = await readJson(req, schema);
  const before = { areaServed: s.partner.areaServed, whatsappOptIn: s.partner.whatsappOptIn };
  await prisma.partner.update({ where: { id: s.partner.id }, data: { areaServed: body.areaServed, ...(body.whatsappOptIn === undefined ? {} : { whatsappOptIn: body.whatsappOptIn }) } });
  await audit(repo, { userId: s.user.id, action: "PROFILE_UPDATE", entityType: "Partner", entityId: s.partner.id, before, after: body });
  return { ok: true };
});
