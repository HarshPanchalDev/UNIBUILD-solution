import { z } from "zod";
import { api, readJson, idParam } from "@/lib/server/api";
import { prisma, repo } from "@/lib/server/db";
import { requireApiUser, clientIp, normalizeMobile } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/crypto";
import { audit } from "@/lib/loyalty/notify";
import { conflict, invalid, notFound } from "@/lib/loyalty/errors";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  mobile: z.string().trim().optional().default(""),
  role: z.enum(["STORE_MANAGER", "OWNER"]),
  isActive: z.boolean(),
  password: z.string().max(200).optional().default(""),
});

export const PATCH = api(async (req, { id }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "staff.manage" });
  const userId = idParam(id);
  const body = await readJson(req, schema);
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before || before.role === "PARTNER") throw notFound("Staff account");
  if (userId === s.user.id && (!body.isActive || body.role !== "OWNER")) throw invalid("You cannot deactivate yourself or remove your own Owner role");
  if (before.role === "OWNER" && (body.role !== "OWNER" || !body.isActive)) {
    const owners = await prisma.user.count({ where: { role: "OWNER", isActive: true } });
    if (owners <= 1) throw invalid("There must be at least one active Owner");
  }
  const mobile = body.mobile ? normalizeMobile(body.mobile) : null;
  if (body.mobile && !mobile) throw invalid("Enter a valid 10-digit mobile number");
  const clash = await prisma.user.findFirst({ where: { id: { not: userId }, OR: [{ email: body.email }, ...(mobile ? [{ mobile }] : [])] } });
  if (clash) throw conflict("Another user already has this email or mobile");
  if (body.password && (body.password.length < 10 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password))) {
    throw invalid("Password must be at least 10 characters with letters and numbers", { password: "weak" });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { name: body.name, email: body.email, mobile, role: body.role, isActive: body.isActive, ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}) },
  });
  if (!body.isActive || body.password) await prisma.session.deleteMany({ where: { userId } }); // sign out everywhere
  await audit(repo, {
    userId: s.user.id,
    action: "STAFF_UPDATE",
    entityType: "User",
    entityId: userId,
    before: { name: before.name, email: before.email, role: before.role, isActive: before.isActive },
    after: { name: body.name, email: body.email, role: body.role, isActive: body.isActive, passwordChanged: Boolean(body.password) },
    ip: await clientIp(),
  });
  return { ok: true };
});
