import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db.js";
import { randomToken, sha256, hashOtp, generateOtp, safeEqualHex, verifyPassword } from "./crypto.js";
import { rateLimit, clearRateLimit } from "./rateLimit.js";
import { sendOtpSms, devShowOtp } from "./sms.js";
import { AppError, invalid } from "../loyalty/errors.js";
import { can, isStaffRole } from "./permissions.js";

export const SESSION_COOKIE = "ub_session";
const PARTNER_SESSION_DAYS = 30;
const STAFF_SESSION_HOURS = 12;
const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 5;

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

// ───────────── sessions ─────────────

export async function createSession(user) {
  const token = randomToken(32);
  const ms = user.role === "PARTNER" ? PARTNER_SESSION_DAYS * 86400000 : STAFF_SESSION_HOURS * 3600000;
  const expiresAt = new Date(Date.now() + ms);
  const h = await headers();
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId: user.id, expiresAt, ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 255) ?? null },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Current user from the session cookie, validated against the database. */
export async function getSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { partner: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  const { user } = session;
  return {
    sessionId: session.id,
    user: { id: user.id, role: user.role, name: user.name, mobile: user.mobile, email: user.email },
    partner: user.partner ?? null,
  };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

// ───────────── guards for pages ─────────────

export async function requirePartnerPage() {
  const s = await getSession();
  if (!s || s.user.role !== "PARTNER" || !s.partner) redirect("/login");
  return s;
}

export async function requireStaffPage(permission = "dashboard.view") {
  const s = await getSession();
  if (!s || !isStaffRole(s.user.role)) redirect("/staff/login");
  if (!can(s.user.role, permission)) redirect("/admin?denied=1");
  return s;
}

// ───────────── guards for API ─────────────

export async function requireApiUser({ role, permission } = {}) {
  const s = await getSession();
  if (!s) throw new AppError("UNAUTHENTICATED", "Please sign in again", 401);
  if (role === "PARTNER" && (s.user.role !== "PARTNER" || !s.partner)) throw new AppError("FORBIDDEN", "Partners only", 403);
  if (role === "STAFF" && !isStaffRole(s.user.role)) throw new AppError("FORBIDDEN", "Staff only", 403);
  if (permission && !can(s.user.role, permission)) throw new AppError("FORBIDDEN", "You do not have permission to do this", 403);
  return s;
}

// ───────────── OTP ─────────────

export const normalizeMobile = (m) => {
  const digits = String(m ?? "").replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
};

/** Send a one-time code. Rate limited per mobile and per IP. Returns { devOtp? } in dev mode only. */
export async function issueOtp(mobile, purpose) {
  const ip = await clientIp();
  await rateLimit(`otp:mobile:${mobile}`, 3, 10 * 60);
  await rateLimit(`otp:ip:${ip}`, 20, 60 * 60);
  const code = generateOtp();
  await prisma.otpRequest.updateMany({ where: { mobile, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpRequest.create({
    data: { mobile, purpose, codeHash: hashOtp(mobile, purpose, code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60000), ip },
  });
  await sendOtpSms(mobile, code);
  return devShowOtp() ? { devOtp: code } : {};
}

/** Verify and consume the latest code. Throws a friendly error on failure. */
export async function verifyOtp(mobile, purpose, code) {
  if (!/^\d{6}$/.test(String(code ?? ""))) throw invalid("Enter the 6-digit code");
  const ip = await clientIp();
  await rateLimit(`otp-verify:ip:${ip}`, 30, 15 * 60);
  const otp = await prisma.otpRequest.findFirst({ where: { mobile, purpose, consumedAt: null }, orderBy: { id: "desc" } });
  if (!otp || otp.expiresAt <= new Date()) throw invalid("The code has expired. Please request a new one.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid("Too many wrong attempts. Please request a new code.");
  if (!safeEqualHex(otp.codeHash, hashOtp(mobile, purpose, String(code)))) {
    await prisma.otpRequest.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw invalid("Wrong code. Please check and try again.");
  }
  await prisma.otpRequest.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}

// ───────────── staff password login ─────────────

export async function checkStaffPassword(identifier, password) {
  const id = String(identifier ?? "").trim().toLowerCase();
  const ip = await clientIp();
  await rateLimit(`staff-login:ip:${ip}`, 20, 15 * 60);
  await rateLimit(`staff-login:id:${id}`, 8, 15 * 60);
  const mobile = normalizeMobile(id);
  const user = await prisma.user.findFirst({
    where: { role: { in: ["STORE_MANAGER", "OWNER"] }, OR: [{ email: id }, ...(mobile ? [{ mobile }] : [])] },
  });
  // Always run a hash comparison so response time does not reveal which accounts exist.
  const ok = await verifyPassword(String(password ?? ""), user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!user || !ok || !user.isActive) throw new AppError("INVALID_LOGIN", "Wrong email/mobile or password", 401);
  await clearRateLimit(`staff-login:id:${id}`);
  return user;
}

export const staffOtpRequired = () => process.env.STAFF_OTP_REQUIRED === "true";
