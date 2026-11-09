// Sites (spec section 5): codes are permanent, merged codes keep resolving, duplicate phone warning.
import { conflict, invalid, notFound } from "./errors.js";
import { audit } from "./notify.js";
import { WALK_IN } from "./constants.js";

export const SITE_CODE_RE = /^[A-Z]{2,5}-\d{4,6}$/;

export function normalizePhone(p) {
  const digits = String(p ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Resolve a code from an invoice to the live site. Follows merges and aliases. */
export async function resolveSiteCode(repo, rawCode) {
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!code || code === WALK_IN) return null;
  let site = await repo.findSiteByCode(code);
  if (!site) site = await repo.findAliasSite(code);
  let hops = 0;
  while (site && site.status === "MERGED" && site.mergedIntoId && hops < 10) {
    site = await repo.getSite(site.mergedIntoId);
    hops++;
  }
  return site && site.status !== "MERGED" ? site : null;
}

/** SITE-01: active sites in the same colony that already have one of these phones. */
export async function findDuplicatePhones(repo, { phones, colony, excludeSiteId = null }) {
  if (!phones?.length || !colony) return [];
  const hits = await repo.findActiveSitesWithPhones(phones, colony);
  return hits.filter((h) => h.siteId !== excludeSiteId);
}

async function nextSiteCode(repo, prefix) {
  const p = String(prefix || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (p.length < 2 || p.length > 5) throw invalid("Area prefix must be 2 to 5 letters, e.g. SAL");
  for (let i = 0; i < 50; i++) {
    const n = await repo.nextSequence(`SITE-${p}`);
    const code = `${p}-${String(n).padStart(4, "0")}`;
    if (!(await repo.findSiteByCode(code)) && !(await repo.findAliasSite(code))) return code;
  }
  throw conflict("Could not generate a free Site Code");
}

function cleanSiteInput(input, { requirePhone = true } = {}) {
  const errors = {};
  const ownerName = String(input.ownerName ?? "").trim();
  const colony = String(input.colony ?? "").trim();
  const phones = [...new Set((input.phones ?? []).map(normalizePhone).filter(Boolean))];
  if (ownerName.length < 2) errors.ownerName = "Owner name is required";
  if (colony.length < 2) errors.colony = "Colony / address is required";
  if (requirePhone && phones.length === 0) errors.phones = "At least one 10-digit phone number is required";
  const mapsUrl = String(input.mapsUrl ?? "").trim();
  if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) errors.mapsUrl = "Maps link must start with http:// or https://";
  if (Object.keys(errors).length) throw invalid("Please check the site details", errors);
  return {
    ownerName: ownerName.slice(0, 120),
    colony: colony.slice(0, 120),
    address: String(input.address ?? "").trim().slice(0, 255) || null,
    mapsUrl: mapsUrl.slice(0, 500) || null,
    displayName: String(input.displayName ?? "").trim().slice(0, 120) || null,
    phones,
  };
}

/**
 * Create a site. Either `code` (as created in BUSY) or `areaPrefix` (auto-number) is required.
 * Throws CONFLICT with details.duplicates when phones match another active site in the colony,
 * unless confirmDuplicates is true.
 */
export async function createSite(repo, input, { userId = null, ip = null } = {}) {
  const data = cleanSiteInput(input);
  return repo.transaction(async (tx) => {
    let code;
    if (input.code) {
      code = String(input.code).trim().toUpperCase();
      if (code === WALK_IN) throw invalid("WALK-IN is reserved and cannot be a site");
      if (!SITE_CODE_RE.test(code)) throw invalid("Site Code must look like SAL-0001 (area letters, dash, number)");
      if ((await tx.findSiteByCode(code)) || (await tx.findAliasSite(code))) throw conflict(`Site Code ${code} already exists or was used before. Codes are never reused.`);
    } else {
      code = await nextSiteCode(tx, input.areaPrefix);
    }
    const duplicates = await findDuplicatePhones(tx, { phones: data.phones, colony: data.colony });
    if (duplicates.length && !input.confirmDuplicates) {
      throw conflict("A phone number already belongs to an active site in this colony", { duplicates });
    }
    const site = await tx.createSite({
      code,
      ...data,
      status: "ACTIVE",
      isIncomplete: Boolean(input.isIncomplete),
      source: input.source ?? "ADMIN",
      submittedByPartnerId: input.submittedByPartnerId ?? null,
      createdById: userId,
    });
    await audit(tx, { userId, action: "SITE_CREATE", entityType: "Site", entityId: site.id, after: { code, ...data, duplicatesConfirmed: duplicates.length > 0 }, ip });
    return { site, duplicates };
  });
}

export async function updateSite(repo, siteId, input, { userId = null, ip = null } = {}) {
  return repo.transaction(async (tx) => {
    const site = await tx.getSite(siteId);
    if (!site || site.status === "MERGED") throw notFound("Site");
    const data = cleanSiteInput({ ...site, ...input, phones: input.phones ?? site.phones }, { requirePhone: true });
    const duplicates = await findDuplicatePhones(tx, { phones: data.phones, colony: data.colony, excludeSiteId: siteId });
    if (duplicates.length && !input.confirmDuplicates) throw conflict("A phone number already belongs to an active site in this colony", { duplicates });
    const updated = await tx.updateSite(siteId, { ...data, isIncomplete: input.isIncomplete ?? false });
    await audit(tx, { userId, action: "SITE_UPDATE", entityType: "Site", entityId: siteId, before: pickSite(site), after: pickSite(updated), ip });
    return updated;
  });
}

const pickSite = (s) => ({ ownerName: s.ownerName, colony: s.colony, address: s.address, mapsUrl: s.mapsUrl, displayName: s.displayName, phones: s.phones, status: s.status });

/** SITE-03: Active <-> Completed. Completed sites still receive invoices; links stay valid. */
export async function setSiteStatus(repo, siteId, status, { userId = null, reason = null, ip = null } = {}) {
  if (!["ACTIVE", "COMPLETED"].includes(status)) throw invalid("Status must be ACTIVE or COMPLETED");
  return repo.transaction(async (tx) => {
    const site = await tx.getSite(siteId);
    if (!site || site.status === "MERGED") throw notFound("Site");
    const updated = await tx.updateSite(siteId, { status });
    await audit(tx, { userId, action: "SITE_STATUS", entityType: "Site", entityId: siteId, before: { status: site.status }, after: { status }, reason, ip });
    return updated;
  });
}

/**
 * SITE-02: merge two codes. The older site survives; links, points, invoice lines and phones move to it;
 * the merged code becomes an alias so later invoices with it still resolve.
 */
export async function mergeSites(repo, { codeA, codeB, reason, userId = null, ip = null }) {
  if (!reason || String(reason).trim().length < 3) throw invalid("A reason is required to merge sites");
  return repo.transaction(async (tx) => {
    const a = await tx.findSiteByCode(String(codeA).trim().toUpperCase());
    const b = await tx.findSiteByCode(String(codeB).trim().toUpperCase());
    if (!a || !b) throw notFound("Site");
    if (a.id === b.id) throw invalid("Choose two different sites");
    if (a.status === "MERGED" || b.status === "MERGED") throw invalid("One of these sites is already merged");
    const [survivor, merged] = new Date(a.createdAt) < new Date(b.createdAt) || (+new Date(a.createdAt) === +new Date(b.createdAt) && a.id < b.id) ? [a, b] : [b, a];

    const survivorLinks = (await tx.listLinksForSite(survivor.id)).filter((l) => l.activeSlot);
    const mergedLinks = (await tx.listLinksForSite(merged.id)).filter((l) => l.activeSlot);
    const clash = mergedLinks.filter((m) => survivorLinks.some((s) => s.trade === m.trade));
    if (clash.length) {
      throw conflict(`Both sites have an active ${clash.map((c) => c.trade.toLowerCase()).join(", ")} link. End one of them before merging.`, { trades: clash.map((c) => c.trade) });
    }
    await tx.moveSiteReferences(merged.id, survivor.id);
    await tx.createSiteAlias({ alias: merged.code, siteId: survivor.id });
    await tx.updateSite(merged.id, { status: "MERGED", mergedIntoId: survivor.id });
    await audit(tx, {
      userId,
      action: "SITE_MERGE",
      entityType: "Site",
      entityId: survivor.id,
      before: { survivor: survivor.code, merged: merged.code },
      after: { survivor: survivor.code, alias: merged.code },
      reason,
      ip,
    });
    return { survivor: await tx.getSite(survivor.id), merged: merged.code };
  });
}
