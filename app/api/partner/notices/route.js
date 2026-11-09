import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";

const schema = z.object({ ids: z.array(z.number().int().positive()).max(200).optional(), all: z.boolean().optional() });

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "PARTNER" });
  const { ids, all } = await readJson(req, schema);
  const where = { audience: "PARTNER", userId: s.user.id, readAt: null, ...(all ? {} : { id: { in: ids ?? [] } }) };
  const r = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return { ok: true, updated: r.count };
});
