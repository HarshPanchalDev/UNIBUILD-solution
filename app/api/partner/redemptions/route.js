import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rateLimit";
import { requestRedemption } from "@/lib/loyalty/redemptions";
import { getActiveSettings } from "@/lib/loyalty/settingsService";

const schema = z.object({ rewardId: z.number().int().positive(), notes: z.string().max(500).optional().default("") });

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "PARTNER" });
  await rateLimit(`redeem:${s.partner.id}`, 10, 3600);
  const { rewardId, notes } = await readJson(req, schema);
  const settings = await getActiveSettings(repo);
  const r = await requestRedemption(repo, { partnerId: s.partner.id, rewardId, notes, settings });
  return { ok: true, number: r.number };
});
