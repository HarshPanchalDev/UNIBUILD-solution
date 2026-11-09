import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma, repo } from "@/lib/server/db";
import { verifyOtp, createSession, normalizeMobile } from "@/lib/server/auth";
import { AppError, invalid } from "@/lib/loyalty/errors";
import { notifyStaff, audit } from "@/lib/loyalty/notify";
import { TRADE_LABEL } from "@/lib/loyalty/constants";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  mobile: z.string().trim(),
  trade: z.enum(["CONTRACTOR", "PLUMBER", "ELECTRICIAN", "PAINTER"], { errorMap: () => ({ message: "Choose your trade" }) }),
  areaServed: z.string().trim().min(2, "Enter the area you serve").max(160),
  terms: z.literal(true, { errorMap: () => ({ message: "Please accept the terms and privacy notice" }) }),
  whatsappOptIn: z.boolean().optional().default(false),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const POST = api(async (req) => {
  const body = await readJson(req, schema);
  const mobile = normalizeMobile(body.mobile);
  if (!mobile) throw invalid("Enter a valid 10-digit mobile number", { mobile: "invalid" });
  if (await prisma.user.findUnique({ where: { mobile } })) throw new AppError("ALREADY_REGISTERED", "This number is already registered. Please sign in.", 409);
  await verifyOtp(mobile, "PARTNER_REGISTER", body.code);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { role: "PARTNER", name: body.name, mobile } });
    await tx.partner.create({
      data: { userId: u.id, trade: body.trade, areaServed: body.areaServed, status: "PENDING", termsAcceptedAt: new Date(), whatsappOptIn: body.whatsappOptIn },
    });
    return u;
  });
  await notifyStaff(repo, "STAFF_PARTNER_SIGNUP", { name: body.name, trade: TRADE_LABEL[body.trade] });
  await audit(repo, { userId: user.id, action: "PARTNER_REGISTER", entityType: "User", entityId: user.id, after: { trade: body.trade, areaServed: body.areaServed } });
  await createSession(user);
  return { ok: true, redirect: "/partner" };
});
