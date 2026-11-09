import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { issueOtp, normalizeMobile } from "@/lib/server/auth";
import { AppError, invalid } from "@/lib/loyalty/errors";

const schema = z.object({
  identifier: z.string().trim().min(1).max(20),
  purpose: z.enum(["login", "register"]),
});

const mask = (m) => `+91 ${m.slice(0, 2)}••••••${m.slice(-2)}`;

export const POST = api(async (req) => {
  const { identifier, purpose } = await readJson(req, schema);
  if (purpose === "register") {
    const mobile = normalizeMobile(identifier);
    if (!mobile) throw invalid("Enter a valid 10-digit mobile number", { mobile: "invalid" });
    const exists = await prisma.user.findUnique({ where: { mobile } });
    if (exists) throw new AppError("ALREADY_REGISTERED", "This number is already registered. Please sign in.", 409);
    const res = await issueOtp(mobile, "PARTNER_REGISTER");
    return { ok: true, sentTo: mask(mobile), ...res };
  }

  // login: mobile number or Partner Code
  let user = null;
  const mobile = normalizeMobile(identifier);
  if (mobile) {
    user = await prisma.user.findUnique({ where: { mobile } });
  } else if (/^UBP-(CO|PL|EL|PA)-\d{4,}$/i.test(identifier)) {
    const partner = await prisma.partner.findUnique({ where: { code: identifier.toUpperCase() }, include: { user: true } });
    user = partner?.user ?? null;
  } else {
    throw invalid("Enter your 10-digit mobile number or Partner Code (e.g. UBP-CO-0001)");
  }
  if (!user || user.role !== "PARTNER") throw new AppError("NOT_REGISTERED", "This number is not registered. Please register first.", 404);
  if (!user.isActive) throw new AppError("INACTIVE", "This account is not active. Please contact the UNIBUILD store.", 403);
  const res = await issueOtp(user.mobile, "PARTNER_LOGIN");
  return { ok: true, sentTo: mask(user.mobile), ...res };
});
