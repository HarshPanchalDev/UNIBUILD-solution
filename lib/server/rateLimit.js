import "server-only";
import { prisma } from "./db.js";
import { AppError } from "../loyalty/errors.js";

/**
 * Fixed-window rate limit stored in MySQL (works across server restarts and multiple instances).
 * Throws 429 when `limit` hits are exceeded within `windowSec`.
 */
export async function rateLimit(key, limit, windowSec) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const k = key.slice(0, 191);
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key: k } });
    if (!existing || existing.resetAt <= now) {
      return tx.rateLimit.upsert({ where: { key: k }, create: { key: k, count: 1, resetAt }, update: { count: 1, resetAt } });
    }
    return tx.rateLimit.update({ where: { key: k }, data: { count: { increment: 1 } } });
  });
  if (row.count > limit) {
    const wait = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 60000));
    throw new AppError("RATE_LIMITED", `Too many attempts. Please try again in ${wait} minute${wait > 1 ? "s" : ""}.`, 429);
  }
}

export async function clearRateLimit(key) {
  await prisma.rateLimit.deleteMany({ where: { key: key.slice(0, 191) } });
}
