import { z } from "zod";
import { api } from "@/lib/server/api";
import { prisma, repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { saveImage } from "@/lib/server/storage";
import { audit } from "@/lib/loyalty/notify";

const rewardFields = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  description: z.string().trim().max(500).optional().default(""),
  section: z.string().trim().min(2).max(60).optional().default("General"),
  points: z.coerce.number().int().min(1, "Points must be at least 1").max(10000000),
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional().default("ACTIVE"),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

function formToObject(form) {
  const o = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

// Owner only (spec 11 — Rewards catalogue). multipart/form-data with optional "image".
export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "rewards.manage" });
  const form = await req.formData();
  const data = rewardFields.parse(formToObject(form));
  const image = form.get("image");
  const imageKey = image && typeof image === "object" && image.size > 0 ? await saveImage(image, "rewards") : null;
  const reward = await prisma.reward.create({ data: { ...data, description: data.description || null, imageKey } });
  await audit(repo, { userId: s.user.id, action: "REWARD_CREATE", entityType: "Reward", entityId: reward.id, after: data, ip: await clientIp() });
  return { ok: true, id: reward.id };
});
