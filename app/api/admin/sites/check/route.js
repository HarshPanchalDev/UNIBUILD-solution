import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";
import { findDuplicatePhones, normalizePhone } from "@/lib/loyalty/sites";

// SITE-01 warning while typing: which active sites in this colony already have these phones?
const schema = z.object({ phones: z.array(z.string()).max(10), colony: z.string().trim().max(120), excludeSiteId: z.number().int().optional() });

export const POST = api(async (req) => {
  await requireApiUser({ role: "STAFF", permission: "sites.manage" });
  const { phones, colony, excludeSiteId } = await readJson(req, schema);
  const clean = phones.map(normalizePhone).filter(Boolean);
  return { duplicates: await findDuplicatePhones(repo, { phones: clean, colony, excludeSiteId: excludeSiteId ?? null }) };
});
