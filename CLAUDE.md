# CLAUDE.md — working rules for the UNIBUILD Partner App

Read `brain.md` first for the business rules and open decisions. This file is how to work in the code.

## Stack
- Next.js 15 App Router, **JavaScript** (no TypeScript), `"type": "module"` (ESM everywhere)
- Tailwind CSS v4 — theme tokens in `app/globals.css` `@theme` (`navy-*`, `brand-*`, fonts). No other CSS framework.
- MySQL 8 + Prisma 6 (`prisma/schema.prisma`). Do not move to Prisma 7 without testing (generator/adapters changed).
- Zod for API input validation, ExcelJS for .xlsx in/out, lucide-react icons.

## Commands
```bash
npm run dev            # dev server
npm test               # 34 tests, no DB needed (node --test)
npx prisma migrate dev --name <change>   # after editing schema.prisma
npm run db:seed        # owner/manager + default settings (idempotent)
npm run db:seed-demo   # dev-only demo data
npm run build          # production build — run before every delivery
npm run cron:daily     # daily jobs
```

## Architecture (keep these boundaries)
- `lib/loyalty/*` — **all business rules**: points, links, sites, exceptions, returns, redemptions, tiers, jobs. Pure JS, no Next/Prisma imports. Every function takes a `repo` as its first argument.
- `lib/busy/*` — BUSY file parsing only. Knows nothing about points (spec 8: a future BUSY API must be able to replace the file reader without touching the engine).
- `lib/repo/prisma.js` and `lib/repo/memory.js` implement the **same repo interface**. If you add a repo method, add it to both, or the tests and production will drift.
- `lib/server/*` — server-only glue: sessions/OTP (`auth.js`), permissions, rate limits, storage, reports, spreadsheets. Files import `"server-only"` (except `crypto.js`, used by seed scripts).
- API routes (`app/api/**/route.js`) are thin: `api()` wrapper → `requireApiUser({ role, permission })` → Zod → call a `lib/loyalty` service. Route files may only export HTTP handlers (+ `maxDuration`/`dynamic`).
- Pages are server components that load data, with small client components for actions. Never pass functions (icons, callbacks) from a server component to a client component — put the action UI in a `"use client"` component (`components/admin/*Actions.jsx`).

## Rules that must never break
1. **Points are calculated only in `lib/loyalty`**, never in the UI or API layer.
2. **Ledger is append-only.** No delete/update of `LedgerEntry`. Corrections = new entries (ADM-03). Point lots change only through `lib/loyalty/ledger.js` helpers.
3. **Money = Decimal, points = Int.** Use `lib/loyalty/money.js` (BigInt) for any calculation. Never `parseFloat` money.
4. Balance changes run inside `repo.transaction()` and call `tx.lockPartner(id)` first.
5. Lot states (Locked/Available/Expired) are **derived from dates** (`lib/loyalty/balance.js`), not stored.
6. Settings are **versioned**. An upload stores `settingsVersionId`; re-processing an exception uses that version, not the current one (T-14).
7. Site Codes and Partner Codes are never reused (sequences in `CodeSequence`; merged codes stay as `SiteAlias`).
8. One active link per (site, trade) — enforced by the unique `SiteLink.activeSlot`. Every link change needs a reason and an audit entry.
9. **Partner privacy (T-16):** partner pages read data only through `lib/server/partnerData.js` → `lib/loyalty/partnerViews.js`. Never send invoice amounts, prices, owner names/phones (except sites the partner submitted) or other partners' data to partner screens or `/api/partner/*`.
10. Permissions are checked on the server: pages `requireStaffPage(permission)` / `requirePartnerPage()`, APIs `requireApiUser`. Permission map: `lib/server/permissions.js`.
11. Do not invent business values the Owner has not decided (see brain.md "Open questions"). Make them settings with empty/proposed defaults.
12. No fake numbers on real screens. Development demo data must be labelled (`[DEMO]`) and only created by `prisma/seed-demo.js`.
13. Dev OTP mode (`SMS_PROVIDER=console`) must stay impossible in production.

## Conventions
- Business dates (invoice/link dates) are `"YYYY-MM-DD"` strings in the engine and `@db.Date` in MySQL. Timestamps are `Date`. Use `lib/loyalty/dates.js` (`todayIST`, `addMonths`…).
- Partner-facing text goes in `lib/i18n/hi.js` **and** `lib/i18n/en.js` (same keys). Hindi is the default. Admin panel text is English.
- Notifications store `type` + `data`; text comes from `lib/loyalty/notify.js` templates (both languages).
- Errors for users: throw `AppError`/`invalid()`/`conflict()` from `lib/loyalty/errors.js` with a clear message; the `api()` wrapper turns them into JSON.
- UI building blocks: `components/ui.jsx` (Card, Badge, Table, Pagination, EmptyState…), client helpers in `components/client/` (`ActionDialog`, `Modal`, `useToast`, `callApi`).
- Every list needs empty, loading (`loading.jsx`) and error (`error.jsx`) states. Every button must do something real.

## When you change things
- New business rule → add/extend a test in `tests/` first (memory repo), then implement in `lib/loyalty`.
- Schema change → `npx prisma migrate dev --name …`, update both repos, update `brain.md`.
- After finishing work, add a dated line to the **Progress log** in `brain.md`.
