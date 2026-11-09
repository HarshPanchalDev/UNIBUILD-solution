import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { prisma, repo } from "@/lib/server/db";
import { requireApiUser, clientIp, normalizeMobile } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/crypto";
import { audit } from "@/lib/loyalty/notify";
import { conflict, invalid } from "@/lib/loyalty/errors";

const passwordRule = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and numbers");

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  mobile: z.string().trim().optional().default(""),
  role: z.enum(["STORE_MANAGER", "OWNER"]),
  password: passwordRule,
});

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "STAFF", permission: "staff.manage" });
  const body = await readJson(req, schema);
  const mobile = body.mobile ? normalizeMobile(body.mobile) : null;
  if (body.mobile && !mobile) throw invalid("Enter a valid 10-digit mobile number", { mobile: "invalid" });
  if (await prisma.user.findFirst({ where: { OR: [{ email: body.email }, ...(mobile ? [{ mobile }] : [])] } })) {
    throw conflict("A user with this email or mobile already exists");
  }
  const user = await prisma.user.create({ data: { name: body.name, email: body.email, mobile, role: body.role, passwordHash: await hashPassword(body.password) } });
  await audit(repo, { userId: s.user.id, action: "STAFF_CREATE", entityType: "User", entityId: user.id, after: { name: body.name, email: body.email, role: body.role }, ip: await clientIp() });
  return { ok: true, id: user.id };
});
