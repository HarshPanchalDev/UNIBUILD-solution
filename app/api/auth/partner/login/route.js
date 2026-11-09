import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { verifyOtp, createSession, normalizeMobile } from "@/lib/server/auth";
import { AppError } from "@/lib/loyalty/errors";

const schema = z.object({ identifier: z.string().trim().min(1).max(20), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

export const POST = api(async (req) => {
  const { identifier, code } = await readJson(req, schema);
  const mobile = normalizeMobile(identifier);
  const user = mobile
    ? await prisma.user.findUnique({ where: { mobile } })
    : (await prisma.partner.findUnique({ where: { code: identifier.toUpperCase() }, include: { user: true } }))?.user;
  if (!user || user.role !== "PARTNER" || !user.isActive) throw new AppError("INVALID_LOGIN", "Wrong code. Please check and try again.", 401);
  await verifyOtp(user.mobile, "PARTNER_LOGIN", code);
  await createSession(user);
  return { ok: true, redirect: "/partner" };
});
