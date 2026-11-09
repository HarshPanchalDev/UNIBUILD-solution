import { api } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { runDailyJobs } from "@/lib/loyalty/jobs";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { audit } from "@/lib/loyalty/notify";

// Owner can run the daily jobs by hand (e.g. if the server cron was down). Safe to repeat.
export const POST = api(async () => {
  const s = await requireApiUser({ role: "STAFF", permission: "settings.manage" });
  const result = await runDailyJobs(repo, { settings: await getActiveSettings(repo) });
  await audit(repo, { userId: s.user.id, action: "DAILY_JOBS_MANUAL", entityType: "System", after: result, ip: await clientIp() });
  return { ok: true, result };
});
