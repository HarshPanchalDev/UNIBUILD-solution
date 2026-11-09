// Daily jobs from the command line (alternative to POST /api/cron/daily).
// Server crontab example (00:30 IST):  30 0 * * * cd /var/www/unibuild && npm run cron:daily >> logs/cron.log 2>&1
import { PrismaClient } from "@prisma/client";
import { createPrismaRepo } from "../lib/repo/prisma.js";
import { runDailyJobs } from "../lib/loyalty/jobs.js";
import { getActiveSettings } from "../lib/loyalty/settingsService.js";
import { audit } from "../lib/loyalty/notify.js";

const prisma = new PrismaClient();
const repo = createPrismaRepo(prisma);

try {
  const result = await runDailyJobs(repo, { settings: await getActiveSettings(repo) });
  await audit(repo, { action: "DAILY_JOBS", entityType: "System", after: result });
  console.log(new Date().toISOString(), JSON.stringify(result));
} catch (e) {
  console.error(new Date().toISOString(), "daily jobs failed:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
