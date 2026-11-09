# brain.md — UNIBUILD Partner App knowledge base

Everything a developer (or AI assistant) needs to know about the business, the rules, the decisions and where the project stands. Source: *UNIBUILD Partner App — Product Specification v0.1* + the master development prompt. Update this file whenever a decision is made.

## 1. The business
- **UNIBUILD** — building-materials shop in Salaiya, Bhopal, opening November 2026. Sells cement, waterproofing & hardware, plumbing, electrical, paint.
- Billing is in **BUSY Standard** (configured by the BUSY dealer, not by us). Phase 1 = the Store Manager uploads BUSY exports daily. A direct BUSY API may replace this later.
- **Problem:** contractors/plumbers/electricians/painters decide where a site buys material, but nothing rewards them and the shop doesn't know who influenced which sale.
- **Solution:** each construction site has a **Site Code**; the Store Manager links partners to sites by trade; paid invoices carry the Site Code; the app credits points to the linked partner.

## 2. People and roles
| Role | Uses | Can |
| --- | --- | --- |
| Partner (contractor/plumber/electrician/painter) | Partner app (PWA) | sign in (OTP), see points/tier/history/sites/notices, request site links, redeem |
| Counter staff | BUSY only | pick/create the site on each invoice — **no app login** |
| Store Manager | Admin panel | uploads, exceptions, sites, partner approvals, links, redemptions; reports read-only |
| Owner | Admin panel | everything + settings, rewards catalogue, staff accounts, manual adjustments, audit log, tiers |
| Homeowner | nothing | name/phone stored on the site record only |

## 3. Glossary
- **Site Code** `SAL-0001` = area prefix + number; belongs to the place; permanent; never reused. `WALK-IN` = buyer with no site, never earns.
- **Partner Code** `UBP-CO-0001` (CO contractor, PL plumber, EL electrician, PA painter); issued on approval; never reused.
- **Link** = partner is *the* partner for their trade on one site, 12 months.
- **Paid invoice** = fully paid; only these are in the daily export. **Credit note** = return.
- **Taxable value** = line value before GST (points are on this). **Lock** = 30 days before points can be redeemed.

## 4. Points rules (implemented in `lib/loyalty`)
- Categories: 1 Cement · 2 Waterproofing & Hardware · 3 Plumbing · 4 Electrical · 5 Paint.
- Who earns: 1 & 2 → Contractor; 3 → Plumber; 4 → Electrician; 5 → Painter. No linked partner of that trade on the **invoice date** → that category earns nothing; others on the same invoice still process.
- Rates (settings): cement **1 point per bag**; others **1 point per ₹100** taxable value.
- Per invoice: sum the category (per site), × rate, × tier multiplier, **round down**. Example T-01: 100 bags × 1.25 = **125**; ₹12,450 → **124**.
- Link must cover the invoice date: `start ≤ invoiceDate < min(end, endedOn)`. Invoices dated before the link earn nothing even if paid later (LNK-04).
- Changing the partner: old link ends and new starts the same day; old points stay with the old partner (LNK-05).
- Pending partners earn nothing; suspended partners earn nothing new and can't redeem (PRT-02/05).
- Points are **Locked 30 days**, then **Available**, **expire 12 months** after crediting; used **oldest first**.
- Minimum redemption **500** available points; 1 point = **₹1** (proposed).
- Tiers: Saathi 1× · Silver 1.25× · Gold 1.5× (proposed). Recalculated on the first day of each quarter from paid purchase value on linked sites in the previous quarter, thresholds **per trade** (not decided).
- Rate/setting changes apply only to files uploaded after the change (settings are versioned).

### Returns (credit notes)
- Matched to the **original invoice number + category**; points come off the **partner who earned them**, even if the site's partner changed (RET-01/02).
- Reversal uses the lot's original rate and multiplier. **Implementation choice:** reversed = points on the amount before the return − points on the net amount after it. With 1.25×, returning 10 of 100 bags reverses 13 (125 → 112), and a full return always reverses exactly what was credited. This makes "return after payment" give the same result as "return before payment" (RET-07 netting). *Confirm with the Owner; the spec example shows only a 1× case.*
- Taken first from that invoice's own points (locked or not), then from Available points (RET-04). Balance never below zero (RET-08).
- Credit note before the invoice is paid → stored as pending; netted when the invoice arrives (RET-07).
- No points on the original line (WALK-IN / unlinked) → nothing changes (RET-06).

### Exceptions (spec 8.4)
- Missing Site Code, unknown Site Code, missing/invalid category, invalid number/date → exceptions queue, no points until fixed and re-processed (exactly once).
- WALK-IN → ignored, not an exception. No partner linked → recorded as "unlinked" (NO_PARTNER), not an exception.
- Bad invoice/payment dates park the whole invoice; re-uploading a corrected file closes those exceptions automatically.

## 5. Technical decisions (and why)
| Decision | Why |
| --- | --- |
| Next.js full-stack, JavaScript | frontend already in Next.js; one codebase for a solo developer |
| MySQL 8 + Prisma | developer knows MySQL; relational DB needed for ledger + transactions |
| Repo interface (prisma + memory) | the engine is tested without a database (34 tests run anywhere) |
| Point lots + allocations | "oldest first", lock/expiry per credit, and refunds to the exact lots |
| States derived from dates | a missed cron can't make points wrongly available/locked |
| Settings as versions (JSON) | old transactions never recalculated; full history for audit |
| `SiteLink.activeSlot` unique column | MySQL has no partial unique index; enforces one active link per trade |
| BigInt money maths | ₹12,450 → 124 exactly; no float rounding |
| Own OTP + DB sessions (no auth library) | phone OTP for partners, password(+OTP) for staff, server-side revocation |
| Rate limits stored in MySQL | works across restarts and multiple app instances |
| Local disk storage behind `/api/files` | photos are private; easy swap to S3/R2 |
| Hand-written service worker | caches only static files; never caches partner/admin data |
| Hindi via own dictionary (`lib/i18n`) | no extra dependency; cookie `ub_lang`, Hindi default |
| One person = one trade = one Partner Code | Q8 undecided; simplest safe default |

## 6. Open questions (do NOT hard-code an answer)
| # | Question | Status in the app |
| --- | --- | --- |
| Q1 | Can BUSY store Site Code on ship-to, search by phones, make it mandatory? | parser accepts header aliases in `lib/busy/columns.js` |
| Q2 | Can BUSY export only invoices fully paid that day with all columns? | assumed yes; column names to confirm |
| Q3 | Return bigger than balance | setting `shortfallPolicy`: `CAP_AND_FLAG` (default, records a shortfall for the Owner) or `CARRY_FORWARD` (recover from next points). Suggested fix in spec: 30-day return policy |
| Q4 | Credit-note export with original invoice number | assumed yes |
| Q5 | BUSY API and cost | not started (parser is separate so it can be swapped) |
| Q6 | ₹1/point, 12-month expiry, 500 minimum | proposed values pre-filled in Settings |
| Q7 | Tier multipliers and thresholds per trade | multipliers pre-filled; thresholds empty → no automatic tier change; Owner can set tiers manually |
| Q8 | One person in two trades? | not supported (one mobile = one partner) |
| Q9 | WhatsApp/SMS notices, provider, cost | opt-in stored; only in-app notices are sent |
| Q10 | Success targets | not in app (reports give the raw numbers) |
| Q11 | Verified badge criteria | Phase 2 — not built |
| Q12 | First reward catalogue | Owner adds in Admin → Rewards |
| — | Reversal rounding for multipliers ≠ 1 | see "Returns" above — confirm |

## 7. Phase 2 (not built; keep room for it)
Digital profile card + "UNIBUILD Verified" badge, branded quotes with trade calculators, job leads. Out of scope for both phases: payments, online ordering, iOS store app, BUSY changes.

## 8. Where things are
- Engine: `lib/loyalty/` — `invoices.js` (credit), `creditNotes.js` (returns), `exceptions.js`, `uploads.js` (file → engine), `links.js`, `sites.js` (merge, duplicates), `partners.js` (approve, suspend, tier, adjust), `redemptions.js`, `linkRequests.js`, `jobs.js` (daily), `partnerViews.js` (privacy-safe partner data), `settings.js` + `settingsService.js`, `ledger.js`, `balance.js`, `money.js`, `dates.js`, `notify.js` (notice texts hi/en + audit helper)
- Parser: `lib/busy/` — `columns.js`, `csv.js`, `parse.js`
- Data: `prisma/schema.prisma`, `lib/repo/prisma.js`, `lib/repo/memory.js`
- Server: `lib/server/` — `auth.js`, `permissions.js`, `api.js`, `rateLimit.js`, `sms.js`, `storage.js`, `spreadsheet.js`, `reports.js`, `partnerData.js`
- Tests: `tests/acceptance.test.js` (T-01…T-17), `tests/rules.test.js`, `tests/samples.test.js`

## 9. Progress log
- 2026-11-03 — Frontend design built from the two image previews (landing, login, partner dashboard web+mobile, sites, rewards, redemption, admin dashboard) with mock data.
- 2026-11-07 — Phase 1 backend and full app: Prisma/MySQL schema; points engine with lots/ledger, returns, exceptions, merges, links, redemptions, tiers, daily jobs; BUSY parser; OTP + staff auth, RBAC, rate limiting; all admin screens (uploads, exceptions, sites, partners, links, redemptions, rewards, settings, staff, reports + Excel, audit log, search); partner app on real data with Hindi/English and PWA; seed + demo seed; sample BUSY files; 34 automated tests passing. Verified here: tests, syntax/import checks of all 157 source files, and rendering of all 28 pages with sample data. **Not yet verified:** `npm install`, `next build`, Prisma migration and runs against a real MySQL — the build workspace had no npm registry access. First local run must do these.

## 10. Next steps
1. Local: `npm install`, `prisma migrate dev`, `npm run build`, click through every workflow with the demo seed; fix anything the build reports.
2. Get the real BUSY export from the BUSY dealer; add its header names to `lib/busy/columns.js`; run a real day's file.
3. MSG91 account + DLT template; test real OTP delivery.
4. Owner decisions: Q3, Q6, Q7 thresholds, Q12 rewards, reversal rounding.
5. Pilot with 10–15 partners (spec section 14).
