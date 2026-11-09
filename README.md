# UNIBUILD Partner App

Loyalty app for UNIBUILD (building materials, Salaiya, Bhopal). Contractors, plumbers, electricians and painters earn points on fully paid purchases for the construction sites they are linked to. The Store Manager uploads the daily BUSY Standard export; the app credits points, handles returns, and runs the reward catalogue.

- **Partner app** — mobile-first PWA, Hindi by default with an English switch: `/login`, `/register`, `/partner/*`
- **Admin panel** — Store Manager and Owner: `/staff/login`, `/admin/*`

Stack: Next.js 15 (App Router, JavaScript) · Tailwind CSS v4 · MySQL 8 · Prisma 6 · ExcelJS · Zod. Points engine and tests use no extra libraries.

---

## 1. Run locally

Requirements: **Node.js 20.9+** (22 LTS recommended) and **MySQL 8**.

```bash
# 1. install
npm install

# 2. database (in the MySQL shell)
CREATE DATABASE unibuild CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'unibuild'@'localhost' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON unibuild.* TO 'unibuild'@'localhost';

# 3. settings
cp .env.example .env          # then edit DATABASE_URL and AUTH_SECRET

# 4. create the tables (first time creates prisma/migrations/…_init)
npx prisma migrate dev --name init

# 5. first Owner + Store Manager accounts and default settings
npm run db:seed

# 6. (optional, development only) demo partners, sites, links, [DEMO] rewards and sample uploads
npm run db:seed-demo

# 7. start
npm run dev                    # http://localhost:3000
```

### Demo accounts (development)

| Who | Where | Sign in |
| --- | --- | --- |
| Owner | `/staff/login` | `owner@unibuild.local` / `Owner@12345` |
| Store Manager | `/staff/login` | `manager@unibuild.local` / `Manager@12345` |
| Partners (after `db:seed-demo`) | `/login` | mobile `9826000001` … `9826000005` (`…05` is pending) |

With `SMS_PROVIDER=console` the 6-digit code is printed in the terminal running `npm run dev`, and also shown on screen when `DEV_SHOW_OTP=true`. This is **development mode only** — it is refused when `NODE_ENV=production`.

## 2. Tests

```bash
npm test
```

34 tests run with Node's built-in test runner against an in-memory copy of the data layer, so they need no database:

- `tests/acceptance.test.js` — the 17 acceptance tests **T-01 … T-17** from the spec (section 14)
- `tests/rules.test.js` — pending/suspended partners, concurrent redemptions, return shortfall policies, link rules, parser edge cases, expiry, adjustments, permissions
- `tests/samples.test.js` — the files in `samples/` behave as documented

The same engine code runs in production against MySQL through `lib/repo/prisma.js`.

## 3. Daily BUSY upload

Admin → **Uploads** → choose *Paid invoices* or *Credit notes* → drop the `.xlsx`/`.csv` → check the preview → **Process file**.

- Required columns are checked first; if one is missing the whole file is rejected and the column is named.
- Each invoice number is processed once. Uploading the same file again skips it.
- Lines with a missing/unknown Site Code or a bad category go to **Exceptions**; fix and re-process them there.
- `WALK-IN` lines are ignored.

Column names can be matched to the real BUSY export in `lib/busy/columns.js` (`aliases`) once the BUSY dealer confirms them (open question Q1/Q2/Q4).

**Sample files** (`samples/`, also downloadable from the Uploads screen):

| File | What it shows |
| --- | --- |
| `paid_invoices_sample.xlsx/.csv` | the T-01 invoice plus waterproofing, electrical, paint, a WALK-IN line, an unknown site and a missing site code |
| `credit_notes_sample.xlsx/.csv` | 10 bags returned on the T-01 invoice → 13 points reversed |
| `paid_invoices_missing_category.*` | rejected file (T-03) |
| `sites_import_sample.*` | field-survey bulk import |

## 4. Daily jobs

Once a day (e.g. 00:30 IST) run expiry, unlock notices, link reminders (30 days before), link expiry and — on the first run of each quarter — tier recalculation:

```bash
# option A: from the server
npm run cron:daily
# crontab:  30 0 * * * cd /var/www/unibuild && npm run cron:daily >> logs/cron.log 2>&1

# option B: over HTTP (e.g. from a cron service)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/daily
```

The Owner can also press **Run daily jobs now** in Settings. Running twice is safe.

## 5. Deploy (single VPS, India region)

Recommended: one small VPS (DigitalOcean Bangalore / AWS Lightsail Mumbai, 2 GB RAM) with MySQL 8, Node 22, nginx and HTTPS (Let's Encrypt). All accounts in UNIBUILD's name (spec section 15).

```bash
git clone <repo> /var/www/unibuild && cd /var/www/unibuild
npm ci
cp .env.example .env    # production values: NODE_ENV is set by `next start`
#   SMS_PROVIDER=msg91 + keys, DEV_SHOW_OTP=false, strong AUTH_SECRET and CRON_SECRET, SEED_* for the first Owner
npx prisma migrate deploy
npm run db:seed
npm run build
npx pm2 start "npm start" --name unibuild    # or a systemd service
```

nginx: proxy `https://your-domain` → `http://127.0.0.1:3000`, set `client_max_body_size 12m;` for uploads, and pass `X-Forwarded-For` / `X-Forwarded-Host`.

Backups (spec NFR): daily `mysqldump` + copy of `STORAGE_DIR`, keep 30 days, and test a restore before launch, e.g.
`0 2 * * * mysqldump unibuild | gzip > /backups/unibuild-$(date +\%F).sql.gz && find /backups -mtime +30 -delete`

## 6. Environment variables

See `.env.example` — every variable is explained there.

## 7. Needs real credentials (not working until configured)

- **SMS OTP (MSG91)** — `lib/server/sms.js`. Written to MSG91's OTP API but not tested with real credentials; needs a DLT-registered template.
- **WhatsApp/SMS notices** — partners can opt in and the choice is stored, but sending notices by WhatsApp/SMS is not built (open question Q9: provider and cost). Notices are in-app.
- **File storage** — local disk (`STORAGE_DIR`). For S3/R2, replace `saveBuffer`/`readStored` in `lib/server/storage.js`.

## 8. Decisions waiting for the Owner

These are settings or clearly marked placeholders, not invented values (details in `brain.md`):

| Spec | Decision | Where it lives now |
| --- | --- | --- |
| Q3 | What happens when a return is larger than the balance | Settings → *Returns larger than the balance* (default: deduct what is possible, record the rest for the Owner) |
| Q6 | 1 point = ₹1, 12-month expiry, 500 minimum | Settings (proposed values pre-filled) |
| Q7 | Tier multipliers and quarterly thresholds per trade | Settings; thresholds empty = tiers not recalculated. Owner can set a tier by hand on the partner page |
| Q8 | One person in two trades | Not supported: one mobile = one partner = one trade |
| Q12 | First reward catalogue | Admin → Rewards (demo seed adds `[DEMO]` items only) |
| Q1/Q2/Q4 | Exact BUSY column names / Site Code field | `lib/busy/columns.js` aliases |

## 9. Project layout

```
app/                    pages and API routes (Next.js App Router)
  api/                  route handlers — every one checks the session and role on the server
  admin/                admin panel pages
  partner/              partner app pages
lib/loyalty/            points engine and business rules (no framework code)
lib/busy/               BUSY file parser (separate from the engine)
lib/repo/               data access: prisma.js (MySQL) and memory.js (tests)
lib/server/             auth, sessions, OTP, rate limits, storage, reports, Excel
lib/i18n/               Hindi and English text for the partner app
components/             UI (client components in components/client, admin/, partner/)
prisma/                 schema and seed scripts
tests/                  automated tests (npm test)
samples/                sample BUSY files
```

`CLAUDE.md` has the working rules for this codebase; `brain.md` has the business rules, decisions and progress.
