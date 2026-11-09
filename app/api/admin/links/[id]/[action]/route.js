import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { endLink, renewLink, changeLinkPartner } from "@/lib/loyalty/links";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { invalid } from "@/lib/loyalty/errors";

const reason = z.string().trim().min(3, "Enter a reason").max(500);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const POST = api(async (req, { id, action }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "links.manage" });
  const linkId = idParam(id);
  const ctx = { linkId, userId: s.user.id, ip: await clientIp() };
  if (action === "end") {
    const body = await readJson(req, z.object({ reason, endDate: date }));
    await endLink(repo, { ...ctx, ...body });
    return { ok: true };
  }
  if (action === "renew") {
    const body = await readJson(req, z.object({ reason }));
    const l = await renewLink(repo, { ...ctx, ...body, settings: await getActiveSettings(repo) });
    return { ok: true, endDate: l.endDate };
  }
  if (action === "change") {
    const body = await readJson(req, z.object({ reason, newPartnerId: z.number().int().positive(), date }));
    const l = await changeLinkPartner(repo, { ...ctx, ...body, settings: await getActiveSettings(repo) });
    return { ok: true, id: l.id };
  }
  throw invalid("Unknown action");
});
