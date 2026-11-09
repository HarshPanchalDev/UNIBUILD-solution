// In-memory repository used by the automated tests (node --test). It implements the same
// interface as lib/repo/prisma.js so the loyalty engine runs unchanged against both.
// Transactions are serialized and rolled back on error, like the database.

const clone = (v) => structuredClone(v);
const dateOnly = (v) => (v === null || v === undefined ? v : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));
const dup = (what) => Object.assign(new Error(`Duplicate ${what}`), { code: "DUPLICATE" });

export function createMemoryRepo() {
  const state = {
    seq: {},
    jobRuns: {},
    users: [],
    partners: [],
    settings: [],
    audit: [],
    notifications: [],
    tierHistory: [],
    sites: [],
    aliases: [],
    links: [],
    linkRequests: [],
    batches: [],
    invoices: [],
    invoiceLines: [],
    creditNotes: [],
    creditLines: [],
    exceptions: [],
    lots: [],
    ledger: [],
    allocations: [],
    shortfalls: [],
    rewards: [],
    redemptions: [],
  };
  let ids = 0;
  const nextId = () => ++ids;
  let lock = Promise.resolve();
  let st = state;

  const find = (table, pred) => st[table].find(pred) ?? null;
  const update = (table, id, data) => {
    const row = st[table].find((r) => r.id === id);
    if (!row) throw new Error(`${table} ${id} not found`);
    Object.assign(row, clone(data));
    row.updatedAt = new Date();
    return clone(row);
  };
  const insert = (table, data) => {
    const row = { id: nextId(), createdAt: new Date(), ...clone(data) };
    st[table].push(row);
    return row;
  };
  const sitePhones = (site) => site; // phones kept on the row

  const api = {
    state: () => st,

    async transaction(fn) {
      if (this.__inTx) return fn(this);
      const run = async () => {
        const snapshot = clone(st);
        const savedIds = ids;
        const tx = Object.create(api);
        tx.__inTx = true;
        try {
          return await fn(tx);
        } catch (e) {
          st = snapshot;
          ids = savedIds;
          throw e;
        }
      };
      const p = lock.then(run, run);
      lock = p.catch(() => {});
      return p;
    },

    async nextSequence(key) {
      st.seq[key] = (st.seq[key] ?? 0) + 1;
      return st.seq[key];
    },
    async markJobRun(key) {
      if (st.jobRuns[key]) return false;
      st.jobRuns[key] = true;
      return true;
    },

    // settings
    async getLatestSettingsVersion() {
      return st.settings.length ? clone(st.settings[st.settings.length - 1]) : null;
    },
    async getSettingsVersion(id) {
      return clone(find("settings", (s) => s.id === id));
    },
    async createSettingsVersion(data) {
      return clone(insert("settings", data));
    },

    async createAudit(data) {
      return clone(insert("audit", data));
    },
    async createNotification(data) {
      return clone(insert("notifications", { readAt: null, ...data }));
    },

    // partners
    async getPartner(id) {
      const p = find("partners", (x) => x.id === id);
      if (!p) return null;
      const u = find("users", (x) => x.id === p.userId);
      return clone({ ...p, name: u?.name, mobile: u?.mobile });
    },
    async lockPartner() {},
    async updatePartner(id, data) {
      if (data.code && st.partners.some((p) => p.code === data.code && p.id !== id)) throw dup("partner code");
      update("partners", id, data);
      return this.getPartner(id);
    },
    async createTierHistory(data) {
      return clone(insert("tierHistory", data));
    },
    async listApprovedPartners() {
      return Promise.all(st.partners.filter((p) => p.status === "APPROVED").map((p) => this.getPartner(p.id)));
    },

    // sites
    async findSiteByCode(code) {
      return clone(find("sites", (s) => s.code === code));
    },
    async findAliasSite(alias) {
      const a = find("aliases", (x) => x.alias === alias);
      return a ? clone(find("sites", (s) => s.id === a.siteId)) : null;
    },
    async getSite(id) {
      return clone(sitePhones(find("sites", (s) => s.id === id)));
    },
    async createSite(data) {
      if (st.sites.some((s) => s.code === data.code)) throw dup("site code");
      return clone(insert("sites", { displayName: null, address: null, mapsUrl: null, mergedIntoId: null, ...data }));
    },
    async updateSite(id, data) {
      return update("sites", id, data);
    },
    async findActiveSitesWithPhones(phones, colony) {
      const c = colony.trim().toLowerCase();
      const out = [];
      for (const s of st.sites) {
        if (s.status !== "ACTIVE" || s.colony.trim().toLowerCase() !== c) continue;
        for (const ph of s.phones) if (phones.includes(ph)) out.push({ siteId: s.id, code: s.code, phone: ph, ownerName: s.ownerName });
      }
      return out;
    },
    async createSiteAlias(data) {
      if (st.aliases.some((a) => a.alias === data.alias)) throw dup("alias");
      return clone(insert("aliases", data));
    },
    async moveSiteReferences(fromId, toId) {
      const to = find("sites", (s) => s.id === toId);
      const from = find("sites", (s) => s.id === fromId);
      for (const l of st.links) {
        if (l.siteId === fromId) {
          l.siteId = toId;
          if (l.activeSlot) l.activeSlot = `${toId}:${l.trade}`;
        }
      }
      for (const l of st.lots) if (l.siteId === fromId) l.siteId = toId;
      for (const l of st.invoiceLines) if (l.siteId === fromId) l.siteId = toId;
      for (const e of st.ledger) if (e.siteId === fromId) e.siteId = toId;
      for (const r of st.linkRequests) if (r.siteId === fromId) r.siteId = toId;
      for (const a of st.aliases) if (a.siteId === fromId) a.siteId = toId;
      to.phones = [...new Set([...to.phones, ...from.phones])];
    },

    // links
    async findLinkCovering(siteId, trade, date) {
      const d = dateOnly(date);
      const l = st.links.find(
        (x) => x.siteId === siteId && x.trade === trade && x.startDate <= d && d < x.endDate && (!x.endedOn || d < x.endedOn)
      );
      return clone(l ?? null);
    },
    async findActiveLink(siteId, trade) {
      return clone(find("links", (l) => l.activeSlot === `${siteId}:${trade}`));
    },
    async getLink(id) {
      return clone(find("links", (l) => l.id === id));
    },
    async createLink(data) {
      if (data.activeSlot && st.links.some((l) => l.activeSlot === data.activeSlot)) throw dup("active link");
      return clone(insert("links", { endedOn: null, reminderSentAt: null, ...data, startDate: dateOnly(data.startDate), endDate: dateOnly(data.endDate) }));
    },
    async updateLink(id, data) {
      const d = { ...data };
      for (const k of ["startDate", "endDate", "endedOn"]) if (d[k]) d[k] = dateOnly(d[k]);
      if (d.activeSlot && st.links.some((l) => l.activeSlot === d.activeSlot && l.id !== id)) throw dup("active link");
      return update("links", id, d);
    },
    async listLinksForSite(siteId) {
      return clone(st.links.filter((l) => l.siteId === siteId));
    },
    async findPartnerLinks(partnerId) {
      return clone(st.links.filter((l) => l.partnerId === partnerId));
    },
    async findLinksDueReminder(limitDate) {
      return clone(st.links.filter((l) => l.activeSlot && !l.reminderSentAt && l.endDate <= limitDate && !l.endedOn));
    },
    async findLinksToExpire(today) {
      return clone(st.links.filter((l) => l.activeSlot && (l.endDate <= today || (l.endedOn && l.endedOn <= today))));
    },

    // invoices
    async findInvoiceByNumber(number) {
      return clone(find("invoices", (i) => i.number === number));
    },
    async createInvoice({ lines, ...data }) {
      if (st.invoices.some((i) => i.number === data.number)) throw dup("invoice");
      const inv = insert("invoices", { ...data, invoiceDate: dateOnly(data.invoiceDate), paymentDate: dateOnly(data.paymentDate) });
      const rows = lines.map((l) => insert("invoiceLines", { ...l, invoiceId: inv.id, lotId: null }));
      return clone({ ...inv, lines: rows });
    },
    async updateInvoiceLine(id, data) {
      return update("invoiceLines", id, data);
    },
    async getInvoiceLine(id) {
      const l = find("invoiceLines", (x) => x.id === id);
      return l ? clone({ ...l, invoice: find("invoices", (i) => i.id === l.invoiceId) }) : null;
    },
    async findInvoiceLines(invoiceId) {
      return clone(st.invoiceLines.filter((l) => l.invoiceId === invoiceId));
    },

    // credit notes
    async findCreditNoteByNumber(number) {
      return clone(find("creditNotes", (c) => c.number === number));
    },
    async createCreditNote({ lines, ...data }) {
      if (st.creditNotes.some((c) => c.number === data.number)) throw dup("credit note");
      const cn = insert("creditNotes", { ...data, noteDate: dateOnly(data.noteDate) });
      const rows = lines.map((l) => insert("creditLines", { pointsReversed: 0, ...l, creditNoteId: cn.id }));
      return clone({ ...cn, lines: rows });
    },
    async updateCreditNoteLine(id, data) {
      return update("creditLines", id, data);
    },
    async findPendingCreditLines(invoiceNumber) {
      return clone(st.creditLines.filter((l) => l.originalInvoiceNumber === invoiceNumber && l.status === "PENDING_INVOICE"));
    },
    async getCreditNoteLine(id) {
      const l = find("creditLines", (x) => x.id === id);
      return l ? clone({ ...l, creditNote: find("creditNotes", (c) => c.id === l.creditNoteId) }) : null;
    },

    // lots & ledger
    async createLot(data) {
      return clone(insert("lots", { redeemedPoints: 0, reversedPoints: 0, expiredPoints: 0, adjustedPoints: 0, unlockNotifiedAt: null, ...data }));
    },
    async getLot(id) {
      return clone(find("lots", (l) => l.id === id));
    },
    async updateLot(id, data) {
      if (data.remaining !== undefined && data.remaining < 0) throw new Error("Lot remaining cannot be negative");
      return update("lots", id, data);
    },
    async findLotsForInvoice(invoiceId) {
      return clone(st.lots.filter((l) => l.invoiceId === invoiceId));
    },
    async findPartnerLots(partnerId, { withRemaining = false } = {}) {
      return clone(st.lots.filter((l) => l.partnerId === partnerId && (!withRemaining || l.remaining > 0)));
    },
    async findExpiredLotsWithRemaining(now) {
      return clone(st.lots.filter((l) => l.remaining > 0 && new Date(l.expiresAt) <= now));
    },
    async findUnlockedNotNotified(now) {
      return clone(st.lots.filter((l) => l.remaining > 0 && !l.unlockNotifiedAt && new Date(l.unlockAt) <= now && new Date(l.expiresAt) > now && l.basisType !== "ADJUSTMENT"));
    },
    async createLedgerEntry(data) {
      return clone(insert("ledger", { lotId: null, invoiceId: null, creditNoteId: null, redemptionId: null, siteId: null, category: null, note: null, ...data }));
    },
    async createAllocation(data) {
      return clone(insert("allocations", data));
    },
    async findAllocationsForLedgerEntry(ledgerEntryId) {
      return clone(st.allocations.filter((a) => a.ledgerEntryId === ledgerEntryId));
    },
    async findRedemptionDebit(redemptionId) {
      return clone(find("ledger", (e) => e.redemptionId === redemptionId && e.type === "REDEMPTION"));
    },
    async findPartnerLedger(partnerId) {
      return clone(st.ledger.filter((e) => e.partnerId === partnerId).sort((a, b) => b.id - a.id));
    },

    // shortfalls
    async createShortfall(data) {
      return clone(insert("shortfalls", { recoveredPoints: 0, ...data }));
    },
    async findOpenShortfalls(partnerId) {
      return clone(st.shortfalls.filter((s) => s.partnerId === partnerId && s.status === "OPEN"));
    },
    async updateShortfall(id, data) {
      return update("shortfalls", id, data);
    },

    // exceptions & batches
    async createException(data) {
      return clone(insert("exceptions", { attempts: 0, history: [], invoiceLineId: null, creditNoteLineId: null, ...data }));
    },
    async getException(id) {
      return clone(find("exceptions", (e) => e.id === id));
    },
    async updateException(id, data) {
      return update("exceptions", id, data);
    },
    async resolveExceptionsByDocument(kind, documentNumber, reason, data) {
      for (const e of st.exceptions) if (e.kind === kind && e.documentNumber === documentNumber && e.reason === reason && e.status === "OPEN") Object.assign(e, clone(data));
    },
    async createBatch(data) {
      return clone(insert("batches", { linesRead: 0, documentsProcessed: 0, documentsSkipped: 0, linesException: 0, linesIgnored: 0, pointsCredited: 0, pointsReversed: 0, ...data }));
    },
    async updateBatch(id, data) {
      return update("batches", id, data);
    },
    async getBatch(id) {
      return clone(find("batches", (b) => b.id === id));
    },

    // rewards & redemptions
    async getReward(id) {
      return clone(find("rewards", (r) => r.id === id));
    },
    async createRedemption(data) {
      return clone(insert("redemptions", data));
    },
    async getRedemption(id) {
      return clone(find("redemptions", (r) => r.id === id));
    },
    async updateRedemption(id, data) {
      return update("redemptions", id, data);
    },

    // link requests
    async createLinkRequest(data) {
      return clone(insert("linkRequests", data));
    },
    async getLinkRequest(id) {
      return clone(find("linkRequests", (r) => r.id === id));
    },
    async updateLinkRequest(id, data) {
      return update("linkRequests", id, data);
    },
    async findPartnerLinkRequests(partnerId) {
      return clone(st.linkRequests.filter((r) => r.partnerId === partnerId));
    },

    async sumCreditedTaxableByPartner(start, end) {
      const totals = new Map();
      for (const lot of st.lots) {
        if (!lot.invoiceId) continue;
        const inv = find("invoices", (i) => i.id === lot.invoiceId);
        if (!inv || inv.paymentDate < start || inv.paymentDate >= end) continue;
        const prev = Number(totals.get(lot.partnerId) ?? 0);
        totals.set(lot.partnerId, (prev + Number(lot.taxableValue)).toFixed(2));
      }
      return totals;
    },

    // ── test helpers (not part of the production interface) ──
    seedUser(data) {
      return clone(insert("users", { isActive: true, ...data }));
    },
    seedPartner({ name = "Partner", mobile, trade, tier = "SAATHI", status = "APPROVED", code = null }) {
      const u = insert("users", { role: "PARTNER", name, mobile: mobile ?? String(9000000000 + ids), isActive: true });
      const p = insert("partners", { userId: u.id, trade, tier, status, code, areaServed: "Bhopal", pendingDeduction: 0, termsAcceptedAt: new Date() });
      return { ...clone(p), name, mobile: u.mobile };
    },
    seedReward(data) {
      return clone(insert("rewards", { status: "ACTIVE", section: "General", ...data }));
    },
  };
  return api;
}
