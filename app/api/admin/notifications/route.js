import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";

const schema = z.object({ ids: z.array(z.number().int().positive()).max(200).optional(), all: z.boolean().optional() });

// Staff notices are shared by all staff (userId NULL) or addressed to one user.
export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF" });
  const { ids, all } = await readJson(req, schema);
  const r = await prisma.notification.updateMany({
    where: { audience: "STAFF", readAt: null, OR: [{ userId: null }, { userId: s.user.id }], ...(all ? {} : { id: { in: ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return { ok: true, updated: r.count };
});
