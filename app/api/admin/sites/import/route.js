import { api } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { readSpreadsheet } from "@/lib/server/spreadsheet";
import { parseSiteImportRows } from "@/lib/busy/parse";
import { createSite } from "@/lib/loyalty/sites";
import { invalid } from "@/lib/loyalty/errors";
import { audit } from "@/lib/loyalty/notify";

export const maxDuration = 120;

// Bulk import from the field survey. mode=preview shows what would happen; mode=import saves.
// Rows with a duplicate phone warning are skipped unless confirmDuplicates=true.
export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "sites.manage" });
  const form = await req.formData();
  const mode = form.get("mode") || "preview";
  const confirmDuplicates = form.get("confirmDuplicates") === "true";
  const { rows } = await readSpreadsheet(form.get("file"));
  const parsed = parseSiteImportRows(rows);
  if (!parsed.ok) throw invalid(parsed.error, { missing: parsed.missing });
  if (parsed.sites.length > 5000) throw invalid("Import up to 5,000 sites at a time");
  const ip = await clientIp();
  const results = [];
  for (const site of parsed.sites) {
    if (mode === "preview") {
      results.push({ row: site.rowNumber, code: site.code, ownerName: site.ownerName, colony: site.colony, phones: site.phones.length, status: "READY" });
      continue;
    }
    try {
      const r = await createSite(repo, { ...site, code: site.code || undefined, areaPrefix: site.code ? undefined : "SRV", source: "FIELD_SURVEY", confirmDuplicates }, { userId: s.user.id, ip });
      results.push({ row: site.rowNumber, code: r.site.code, status: "CREATED" });
    } catch (e) {
      results.push({ row: site.rowNumber, code: site.code, status: e.code === "CONFLICT" && e.details?.duplicates ? "DUPLICATE_PHONE" : "ERROR", error: e.message });
    }
  }
  if (mode !== "preview") {
    await audit(repo, { userId: s.user.id, action: "SITE_IMPORT", entityType: "Site", after: { total: results.length, created: results.filter((r) => r.status === "CREATED").length }, ip });
  }
  return { ok: true, mode, total: results.length, created: results.filter((r) => r.status === "CREATED").length, results: results.slice(0, 1000) };
});
