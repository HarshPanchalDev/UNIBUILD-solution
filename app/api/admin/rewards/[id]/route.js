import { api, idParam } from "@/lib/server/api";
import { prisma, repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { saveImage } from "@/lib/server/storage";
import { audit } from "@/lib/loyalty/notify";
import { notFound } from "@/lib/loyalty/errors";
import { z } from "zod";

const fields = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  description: z.string().trim().max(500).optional().default(""),
  section: z.string().trim().min(2).max(60).optional().default("General"),
  points: z.coerce.number().int().min(1, "Points must be at least 1").max(10000000),
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

// Rewards are never deleted (redemptions keep their history); "Retire" hides them for good.
export const PATCH = api(async (req, { id }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "rewards.manage" });
  const rewardId = idParam(id);
  const before = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!before) throw notFound("Reward");
  const form = await req.formData();
  const raw = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") raw[k] = v;
  const data = fields.parse(raw);
  const image = form.get("image");
  const imageKey = image && typeof image === "object" && image.size > 0 ? await saveImage(image, "rewards") : undefined;
  await prisma.reward.update({ where: { id: rewardId }, data: { ...data, description: data.description || null, ...(imageKey ? { imageKey } : {}) } });
  await audit(repo, {
    userId: s.user.id,
    action: "REWARD_UPDATE",
    entityType: "Reward",
    entityId: rewardId,
    before: { name: before.name, points: before.points, status: before.status },
    after: { name: data.name, points: data.points, status: data.status },
    ip: await clientIp(),
  });
  return { ok: true };
});
