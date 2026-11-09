// Production repository (MySQL via Prisma). Same interface as lib/repo/memory.js.
// Values going to the loyalty engine: decimals as strings, date-only columns as "YYYY-MM-DD".

const D = (v) => (v === null || v === undefined ? v : v.toString()); // Decimal -> string
const ymd = (v) => (v === null || v === undefined ? v : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const toDate = (v) => (v === null || v === undefined ? v : v instanceof Date ? v : new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`));

// Prisma rejects plain null for Json columns; drop null/undefined Json values instead.
function cleanJson(data, keys) {
  const out = { ...data };
  for (const k of keys) if (out[k] === null || out[k] === undefined) delete out[k];
  return out;
}

const mapPartner = (p) => (p ? { ...p, name: p.user?.name, mobile: p.user?.mobile, user: undefined } : null);
const mapSite = (s) => (s ? { ...s, phones: (s.phones ?? []).map((x) => x.phone) } : null);
const mapLink = (l) => (l ? { ...l, startDate: ymd(l.startDate), endDate: ymd(l.endDate), endedOn: ymd(l.endedOn) } : null);
const mapLine = (l) => (l ? { ...l, quantity: D(l.quantity), taxableValue: D(l.taxableValue) } : null);
const mapInvoice = (i) => (i ? { ...i, invoiceDate: ymd(i.invoiceDate), paymentDate: ymd(i.paymentDate), lines: i.lines?.map(mapLine) } : null);
const mapCreditNote = (c) => (c ? { ...c, noteDate: ymd(c.noteDate), lines: c.lines?.map(mapLine) } : null);
const mapLot = (l) =>
  l
    ? {
        ...l,
        basis: D(l.basis),
        returnedBasis: D(l.returnedBasis),
        taxableValue: D(l.taxableValue),
        ratePoints: D(l.ratePoints),
        ratePer: D(l.ratePer),
        multiplier: D(l.multiplier),
      }
    : null;
const linkData = (data) => {
  const d = { ...data };
  for (const k of ["startDate", "endDate", "endedOn"]) if (k in d) d[k] = toDate(d[k]);
  return d;
};

const partnerInclude = { user: { select: { name: true, mobile: true } } };

export function createPrismaRepo(db, inTx = false) {
  const repo = {
    db,

    async transaction(fn) {
      if (inTx) return fn(repo);
      return db.$transaction((tx) => fn(createPrismaRepo(tx, true)), { maxWait: 10000, timeout: 60000 });
    },

    async nextSequence(key) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const row = await db.codeSequence.upsert({ where: { key }, create: { key, next: 2 }, update: { next: { increment: 1 } } });
          return row.next - 1;
        } catch (e) {
          if (e?.code !== "P2002" || attempt === 2) throw e;
        }
      }
      throw new Error("Could not allocate sequence");
    },
    async markJobRun(key) {
      try {
        await db.codeSequence.create({ data: { key: `JOB:${key}`.slice(0, 40), next: 1 } });
        return true;
      } catch (e) {
        if (e?.code === "P2002") return false;
        throw e;
      }
    },

    // settings
    getLatestSettingsVersion: () => db.settingsVersion.findFirst({ orderBy: { id: "desc" } }),
    getSettingsVersion: (id) => db.settingsVersion.findUnique({ where: { id } }),
    createSettingsVersion: (data) => db.settingsVersion.create({ data }),

    createAudit: (data) => db.auditLog.create({ data: cleanJson(data, ["before", "after"]) }),
    createNotification: (data) => db.notification.create({ data: cleanJson(data, ["data"]) }),

    // partners
    async getPartner(id) {
      return mapPartner(await db.partner.findUnique({ where: { id }, include: partnerInclude }));
    },
    async lockPartner(id) {
      if (inTx) await db.$queryRaw`SELECT id FROM \`Partner\` WHERE id = ${id} FOR UPDATE`;
    },
    async updatePartner(id, data) {
      return mapPartner(await db.partner.update({ where: { id }, data, include: partnerInclude }));
    },
    createTierHistory: (data) => db.tierHistory.create({ data: { ...data, purchaseValue: data.purchaseValue ?? undefined } }),
    async listApprovedPartners() {
      return (await db.partner.findMany({ where: { status: "APPROVED" }, include: partnerInclude })).map(mapPartner);
    },

    // sites
    async findSiteByCode(code) {
      return mapSite(await db.site.findUnique({ where: { code }, include: { phones: true } }));
    },
    async findAliasSite(alias) {
      const a = await db.siteAlias.findUnique({ where: { alias }, include: { site: { include: { phones: true } } } });
      return a ? mapSite(a.site) : null;
    },
    async getSite(id) {
      return mapSite(await db.site.findUnique({ where: { id }, include: { phones: true } }));
    },
    async createSite({ phones = [], ...data }) {
      return mapSite(await db.site.create({ data: { ...data, phones: { create: phones.map((phone) => ({ phone })) } }, include: { phones: true } }));
    },
    async updateSite(id, { phones, ...data }) {
      if (phones) {
        await db.sitePhone.deleteMany({ where: { siteId: id } });
        if (phones.length) await db.sitePhone.createMany({ data: phones.map((phone) => ({ siteId: id, phone })) });
      }
      return mapSite(await db.site.update({ where: { id }, data, include: { phones: true } }));
    },
    async findActiveSitesWithPhones(phones, colony) {
      const rows = await db.sitePhone.findMany({
        where: { phone: { in: phones }, site: { status: "ACTIVE", colony: colony.trim() } },
        include: { site: { select: { id: true, code: true, ownerName: true } } },
      });
      return rows.map((r) => ({ siteId: r.site.id, code: r.site.code, phone: r.phone, ownerName: r.site.ownerName }));
    },
    createSiteAlias: (data) => db.siteAlias.create({ data }),
    async moveSiteReferences(fromId, toId) {
      const links = await db.siteLink.findMany({ where: { siteId: fromId } });
      for (const l of links) {
        await db.siteLink.update({ where: { id: l.id }, data: { siteId: toId, activeSlot: l.activeSlot ? `${toId}:${l.trade}` : null } });
      }
      await db.pointLot.updateMany({ where: { siteId: fromId }, data: { siteId: toId } });
      await db.invoiceLine.updateMany({ where: { siteId: fromId }, data: { siteId: toId } });
      await db.ledgerEntry.updateMany({ where: { siteId: fromId }, data: { siteId: toId } });
      await db.siteLinkRequest.updateMany({ where: { siteId: fromId }, data: { siteId: toId } });
      await db.siteAlias.updateMany({ where: { siteId: fromId }, data: { siteId: toId } });
      const [fromPhones, toPhones] = await Promise.all([
        db.sitePhone.findMany({ where: { siteId: fromId } }),
        db.sitePhone.findMany({ where: { siteId: toId } }),
      ]);
      const have = new Set(toPhones.map((p) => p.phone));
      const add = fromPhones.filter((p) => !have.has(p.phone)).map((p) => ({ siteId: toId, phone: p.phone, label: p.label }));
      if (add.length) await db.sitePhone.createMany({ data: add });
    },

    // links
    async findLinkCovering(siteId, trade, date) {
      const d = toDate(date);
      return mapLink(
        await db.siteLink.findFirst({
          where: { siteId, trade, startDate: { lte: d }, endDate: { gt: d }, OR: [{ endedOn: null }, { endedOn: { gt: d } }] },
          orderBy: { startDate: "desc" },
        })
      );
    },
    async findActiveLink(siteId, trade) {
      return mapLink(await db.siteLink.findUnique({ where: { activeSlot: `${siteId}:${trade}` } }));
    },
    async getLink(id) {
      return mapLink(await db.siteLink.findUnique({ where: { id } }));
    },
    async createLink(data) {
      return mapLink(await db.siteLink.create({ data: linkData(data) }));
    },
    async updateLink(id, data) {
      return mapLink(await db.siteLink.update({ where: { id }, data: linkData(data) }));
    },
    async listLinksForSite(siteId) {
      return (await db.siteLink.findMany({ where: { siteId } })).map(mapLink);
    },
    async findPartnerLinks(partnerId) {
      return (await db.siteLink.findMany({ where: { partnerId }, orderBy: { startDate: "desc" } })).map(mapLink);
    },
    async findLinksDueReminder(limitDate) {
      return (await db.siteLink.findMany({ where: { activeSlot: { not: null }, reminderSentAt: null, endedOn: null, endDate: { lte: toDate(limitDate) } } })).map(mapLink);
    },
    async findLinksToExpire(today) {
      const d = toDate(today);
      return (await db.siteLink.findMany({ where: { activeSlot: { not: null }, OR: [{ endDate: { lte: d } }, { endedOn: { lte: d } }] } })).map(mapLink);
    },

    // invoices
    async findInvoiceByNumber(number) {
      return mapInvoice(await db.invoice.findUnique({ where: { number } }));
    },
    async createInvoice({ lines, invoiceDate, paymentDate, ...data }) {
      const inv = await db.invoice.create({
        data: { ...data, invoiceDate: toDate(invoiceDate), paymentDate: toDate(paymentDate), lines: { create: lines } },
        include: { lines: { orderBy: { id: "asc" } } },
      });
      return mapInvoice(inv);
    },
    async updateInvoiceLine(id, data) {
      return mapLine(await db.invoiceLine.update({ where: { id }, data }));
    },
    async getInvoiceLine(id) {
      const l = await db.invoiceLine.findUnique({ where: { id }, include: { invoice: true } });
      return l ? { ...mapLine(l), invoice: mapInvoice(l.invoice) } : null;
    },
    async findInvoiceLines(invoiceId) {
      return (await db.invoiceLine.findMany({ where: { invoiceId } })).map(mapLine);
    },

    // credit notes
    async findCreditNoteByNumber(number) {
      return mapCreditNote(await db.creditNote.findUnique({ where: { number } }));
    },
    async createCreditNote({ lines, noteDate, ...data }) {
      const cn = await db.creditNote.create({
        data: { ...data, noteDate: toDate(noteDate), lines: { create: lines } },
        include: { lines: { orderBy: { id: "asc" } } },
      });
      return mapCreditNote(cn);
    },
    async updateCreditNoteLine(id, data) {
      return mapLine(await db.creditNoteLine.update({ where: { id }, data }));
    },
    async findPendingCreditLines(invoiceNumber) {
      return (await db.creditNoteLine.findMany({ where: { originalInvoiceNumber: invoiceNumber, status: "PENDING_INVOICE" } })).map(mapLine);
    },
    async getCreditNoteLine(id) {
      const l = await db.creditNoteLine.findUnique({ where: { id }, include: { creditNote: true } });
      return l ? { ...mapLine(l), creditNote: mapCreditNote(l.creditNote) } : null;
    },

    // lots & ledger
    async createLot(data) {
      return mapLot(await db.pointLot.create({ data }));
    },
    async getLot(id) {
      return mapLot(await db.pointLot.findUnique({ where: { id } }));
    },
    async updateLot(id, data) {
      if (data.remaining !== undefined && data.remaining < 0) throw new Error("Lot remaining cannot be negative");
      return mapLot(await db.pointLot.update({ where: { id }, data }));
    },
    async findLotsForInvoice(invoiceId) {
      return (await db.pointLot.findMany({ where: { invoiceId }, orderBy: { id: "asc" } })).map(mapLot);
    },
    async findPartnerLots(partnerId, { withRemaining = false } = {}) {
      return (await db.pointLot.findMany({ where: { partnerId, ...(withRemaining ? { remaining: { gt: 0 } } : {}) }, orderBy: { id: "asc" } })).map(mapLot);
    },
    async findExpiredLotsWithRemaining(now) {
      return (await db.pointLot.findMany({ where: { remaining: { gt: 0 }, expiresAt: { lte: now } }, take: 5000 })).map(mapLot);
    },
    async findUnlockedNotNotified(now) {
      return (
        await db.pointLot.findMany({
          where: { remaining: { gt: 0 }, unlockNotifiedAt: null, unlockAt: { lte: now }, expiresAt: { gt: now }, basisType: { not: "ADJUSTMENT" } },
          take: 5000,
        })
      ).map(mapLot);
    },
    createLedgerEntry: (data) => db.ledgerEntry.create({ data }),
    createAllocation: (data) => db.lotAllocation.create({ data }),
    findAllocationsForLedgerEntry: (ledgerEntryId) => db.lotAllocation.findMany({ where: { ledgerEntryId } }),
    findRedemptionDebit: (redemptionId) => db.ledgerEntry.findFirst({ where: { redemptionId, type: "REDEMPTION" } }),
    findPartnerLedger: (partnerId) => db.ledgerEntry.findMany({ where: { partnerId }, orderBy: { id: "desc" }, take: 2000 }),

    // shortfalls
    createShortfall: (data) => db.reversalShortfall.create({ data }),
    findOpenShortfalls: (partnerId) => db.reversalShortfall.findMany({ where: { partnerId, status: "OPEN" }, orderBy: { id: "asc" } }),
    updateShortfall: (id, data) => db.reversalShortfall.update({ where: { id }, data }),

    // exceptions & batches
    createException: (data) => db.uploadException.create({ data: cleanJson(data, ["history"]) }),
    getException: (id) => db.uploadException.findUnique({ where: { id } }),
    updateException: (id, data) => db.uploadException.update({ where: { id }, data: cleanJson(data, ["history"]) }),
    resolveExceptionsByDocument: (kind, documentNumber, reason, data) =>
      db.uploadException.updateMany({ where: { kind, documentNumber, reason, status: "OPEN" }, data }),
    createBatch: (data) => db.uploadBatch.create({ data: cleanJson(data, ["summary"]) }),
    updateBatch: (id, data) => db.uploadBatch.update({ where: { id }, data: cleanJson(data, ["summary"]) }),
    getBatch: (id) => db.uploadBatch.findUnique({ where: { id } }),

    // rewards & redemptions
    getReward: (id) => db.reward.findUnique({ where: { id } }),
    createRedemption: (data) => db.redemption.create({ data }),
    getRedemption: (id) => db.redemption.findUnique({ where: { id } }),
    updateRedemption: (id, data) => db.redemption.update({ where: { id }, data }),

    // link requests
    createLinkRequest: (data) => db.siteLinkRequest.create({ data }),
    getLinkRequest: (id) => db.siteLinkRequest.findUnique({ where: { id } }),
    updateLinkRequest: (id, data) => db.siteLinkRequest.update({ where: { id }, data }),
    findPartnerLinkRequests: (partnerId) => db.siteLinkRequest.findMany({ where: { partnerId } }),

    async sumCreditedTaxableByPartner(start, end) {
      const rows = await db.pointLot.groupBy({
        by: ["partnerId"],
        where: { invoice: { paymentDate: { gte: toDate(start), lt: toDate(end) } } },
        _sum: { taxableValue: true },
      });
      return new Map(rows.map((r) => [r.partnerId, D(r._sum.taxableValue ?? "0")]));
    },
  };
  return repo;
}
