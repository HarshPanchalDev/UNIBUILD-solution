import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { updateSettings } from "@/lib/loyalty/settingsService";

const schema = z.object({ values: z.record(z.any()), note: z.string().trim().max(500).optional().default("") });

// Owner only. Validation lives in lib/loyalty/settings.js (validateSettings).
export const PUT = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "settings.manage" });
  const { values, note } = await readJson(req, schema);
  const v = await updateSettings(repo, { values, note: note || null, userId: s.user.id, ip: await clientIp() });
  return { ok: true, versionId: v.id };
});
