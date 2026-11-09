import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { repo } from "@/lib/server/db";
import { runDailyJobs } from "@/lib/loyalty/jobs";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { audit } from "@/lib/loyalty/notify";
import { errorResponse } from "@/lib/server/api";

export const maxDuration = 300;

// Call once a day (e.g. 00:30 IST):  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/daily
export async function POST(req) {
  try {
    const secret = process.env.CRON_SECRET;
    const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const ok = secret && secret.length >= 24 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await runDailyJobs(repo, { settings: await getActiveSettings(repo) });
    await audit(repo, { action: "DAILY_JOBS", entityType: "System", after: result });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return errorResponse(e);
  }
}
