# Demo (staging) server — show the app to the client before launch

A hosted copy with **demo data**, sign-in codes **shown on screen** (no SMS needed) and a yellow
"DEMO / TEST SERVER" banner on every page. It is not the live app: never put real partners or real BUSY files here.

This guide uses **Railway** (app + MySQL in one place, deploys from GitHub). Any host that runs Node 22+ and MySQL 8 works the same way. Check Railway's current pricing before you start; a small demo usually fits the cheapest paid plan.

## 1. Code on GitHub
Push the project to a **private** GitHub repository (including `prisma/migrations`). `.env`, `node_modules`, `.next`, `storage/` and `backups/` are ignored and must not be pushed.

## 2. Create the services
1. railway.com → **New Project** → **Deploy from GitHub repo** → pick the repository.
2. In the same project: **+ New** → **Database** → **MySQL**.

## 3. Variables (app service → Variables)
| Name | Value |
| --- | --- |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (reference to the MySQL service) |
| `AUTH_SECRET` | 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
| `CRON_SECRET` | another 24+ random characters |
| `STAGING_MODE` | `true` |
| `SMS_PROVIDER` | `console` |
| `STAFF_OTP_REQUIRED` | `false` |
| `SEED_OWNER_NAME` / `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | demo Owner login (password 10+ characters) |
| `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` | demo Store Manager login |
| `STORAGE_DIR` | `/app/storage` |

## 4. Build and start
App service → **Settings**:
- Build command: `npm run build` (Railway runs `npm ci` first; `postinstall` runs `prisma generate`)
- Start command: `npm run start:staging` — applies migrations, creates the Owner/Manager, adds demo data (all safe to repeat), then starts the app on Railway's `PORT`.
- **Volume**: add one mounted at `/app/storage` so uploaded photos/files survive redeploys.
- **Networking** → **Generate Domain** → you get an `https://….up.railway.app` link.

## 5. Check
Open the link: the yellow banner must be visible. Partner login with demo mobile `9826000001` shows the code on screen. Staff login with the `SEED_OWNER_*` values. Run `node scripts/smoke.js https://….up.railway.app <owner-email> <owner-password>` from your PC.

## Going live later (different server or project)
Do **not** reuse the demo database. On the live app: `STAGING_MODE` unset or `false`, `SMS_PROVIDER=msg91` with real keys, no `seed-demo`, start command `npm start` after `npx prisma migrate deploy` and `npm run db:seed`, daily `npm run cron:daily` and `npm run db:backup`. See README section 5.
