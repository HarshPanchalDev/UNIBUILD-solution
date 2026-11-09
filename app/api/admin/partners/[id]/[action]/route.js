import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { approvePartner, rejectPartner, suspendPartner, reinstatePartner, setPartnerTier, adjustPoints } from "@/lib/loyalty/partners";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { invalid } from "@/lib/loyalty/errors";

const reasonSchema = z.object({ reason: z.string().trim().min(3, "Enter a reason").max(500) });
const tierSchema = reasonSchema.extend({ tier: z.enum(["SAATHI", "SILVER", "GOLD"]) });
const adjustSchema = reasonSchema.extend({ points: z.number().int().refine((n) => n !== 0, "Points cannot be zero") });

// Owner-only actions are checked here; the rest need partners.manage (Store Manager or Owner).
const OWNER_ACTIONS = { tier: "tiers.manage", adjust: "points.adjust" };

export const POST = api(async (req, { id, action }) => {
  const s = await requireApiUser({ role: "STAFF", permission: OWNER_ACTIONS[action] ?? "partners.manage" });
  const partnerId = idParam(id);
  const ctx = { partnerId, userId: s.user.id, ip: await clientIp() };
  switch (action) {
    case "approve":
      return { ok: true, partner: pick(await approvePartner(repo, ctx)) };
    case "reject":
      return { ok: true, partner: pick(await rejectPartner(repo, { ...ctx, ...(await readJson(req, reasonSchema)) })) };
    case "suspend":
      return { ok: true, partner: pick(await suspendPartner(repo, { ...ctx, ...(await readJson(req, reasonSchema)) })) };
    case "reinstate":
      return { ok: true, partner: pick(await reinstatePartner(repo, { ...ctx, ...(await readJson(req, reasonSchema)) })) };
    case "tier": {
      const body = await readJson(req, tierSchema);
      return { ok: true, partner: pick(await setPartnerTier(repo, { ...ctx, ...body, settings: await getActiveSettings(repo) })) };
    }
    case "adjust": {
      const body = await readJson(req, adjustSchema);
      await adjustPoints(repo, { ...ctx, ...body, settings: await getActiveSettings(repo) });
      return { ok: true };
    }
    default:
      throw invalid("Unknown action");
  }
});

const pick = (p) => ({ id: p.id, code: p.code, status: p.status, tier: p.tier });
