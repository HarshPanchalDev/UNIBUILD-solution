// "Request site link" from the partner app (spec 6.2 step 1). The Store Manager verifies and links.
import { invalid, notFound, conflict } from "./errors.js";
import { audit, notifyPartner, notifyStaff } from "./notify.js";
import { resolveSiteCode, normalizePhone, createSite } from "./sites.js";
import { createLink } from "./links.js";

export async function createLinkRequest(repo, { partnerId, input }) {
  return repo.transaction(async (tx) => {
    const partner = await tx.getPartner(partnerId);
    if (!partner) throw notFound("Partner");
    if (partner.status !== "APPROVED") throw invalid("Your registration must be approved before you can request site links");
    const open = (await tx.findPartnerLinkRequests(partnerId)).filter((r) => r.status === "PENDING");
    if (open.length >= 10) throw invalid("You already have 10 requests waiting. Please wait for the store to review them.");

    let data;
    if (input.type === "EXISTING_SITE") {
      const code = String(input.siteCode ?? "").trim().toUpperCase();
      if (!/^[A-Z]{2,5}-\d{4,6}$/.test(code)) throw invalid("Enter a valid Site Code, e.g. SAL-0012", { siteCode: "Invalid Site Code" });
      const site = await resolveSiteCode(tx, code);
      if (!site) throw invalid("This Site Code was not found. Submit it as a new site instead.", { siteCode: "Not found" });
      if (open.some((r) => r.siteId === site.id)) throw conflict("You already requested this site");
      const active = await tx.findActiveLink(site.id, partner.trade);
      if (active && active.partnerId === partnerId) throw conflict("You are already linked to this site");
      data = { type: "EXISTING_SITE", siteCode: site.code, siteId: site.id };
    } else if (input.type === "NEW_SITE") {
      const errors = {};
      const ownerName = String(input.ownerName ?? "").trim();
      const phone = normalizePhone(input.phone);
      const colony = String(input.colony ?? "").trim();
      const mapsUrl = String(input.mapsUrl ?? "").trim();
      if (ownerName.length < 2) errors.ownerName = "Owner name is required";
      if (!phone) errors.phone = "Enter a 10-digit phone number";
      if (colony.length < 2) errors.colony = "Colony / address is required";
      if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) errors.mapsUrl = "Enter a valid link";
      if (Object.keys(errors).length) throw invalid("Please check the site details", errors);
      data = { type: "NEW_SITE", ownerName: ownerName.slice(0, 120), phone, colony: colony.slice(0, 120), mapsUrl: mapsUrl.slice(0, 500) || null };
    } else {
      throw invalid("Choose existing or new site");
    }
    const req = await tx.createLinkRequest({ partnerId, status: "PENDING", ...data });
    await notifyStaff(tx, "STAFF_LINK_REQUEST", { partnerCode: partner.code, summary: data.type === "EXISTING_SITE" ? `Existing site ${data.siteCode}` : `New site in ${data.colony}` });
    await audit(tx, { userId: partner.userId, action: "LINK_REQUEST", entityType: "SiteLinkRequest", entityId: req.id, after: { type: data.type, siteCode: data.siteCode ?? null } });
    return req;
  });
}

/**
 * Approve: for a new site, the Store Manager first creates it in BUSY and enters the same code here
 * (or uses an area prefix to auto-number); then the partner is linked.
 */
export async function approveLinkRequest(repo, { requestId, siteCode, areaPrefix, confirmDuplicates = false, reason, userId = null, ip = null, now = new Date(), settings }) {
  return repo.transaction(async (tx) => {
    const req = await tx.getLinkRequest(requestId);
    if (!req) throw notFound("Request");
    if (req.status !== "PENDING") throw conflict("This request was already reviewed");
    let siteId = req.siteId;
    if (req.type === "NEW_SITE") {
      const { site } = await createSite(
        tx,
        { code: siteCode || undefined, areaPrefix, ownerName: req.ownerName, phones: [req.phone], colony: req.colony, mapsUrl: req.mapsUrl, source: "PARTNER_REQUEST", submittedByPartnerId: req.partnerId, isIncomplete: true, confirmDuplicates },
        { userId, ip }
      );
      siteId = site.id;
    }
    const link = await createLink(tx, { siteId, partnerId: req.partnerId, reason: reason || `Approved site link request #${req.id}`, userId, ip, now, settings });
    const updated = await tx.updateLinkRequest(requestId, { status: "APPROVED", reviewedById: userId, reviewedAt: now, siteId, linkId: link.id, reviewNote: reason || null });
    await audit(tx, { userId, action: "LINK_REQUEST_APPROVE", entityType: "SiteLinkRequest", entityId: requestId, after: { siteId, linkId: link.id }, reason, ip });
    return updated;
  });
}

export async function rejectLinkRequest(repo, { requestId, reason, userId = null, ip = null, now = new Date() }) {
  const why = String(reason ?? "").trim();
  if (why.length < 3) throw invalid("A reason is required to reject a request");
  return repo.transaction(async (tx) => {
    const req = await tx.getLinkRequest(requestId);
    if (!req) throw notFound("Request");
    if (req.status !== "PENDING") throw conflict("This request was already reviewed");
    const updated = await tx.updateLinkRequest(requestId, { status: "REJECTED", reviewedById: userId, reviewedAt: now, reviewNote: why.slice(0, 500) });
    const partner = await tx.getPartner(req.partnerId);
    await audit(tx, { userId, action: "LINK_REQUEST_REJECT", entityType: "SiteLinkRequest", entityId: requestId, reason: why, ip });
    await notifyPartner(tx, partner, "LINK_REQUEST_REJECTED", { reason: why });
    return updated;
  });
}
