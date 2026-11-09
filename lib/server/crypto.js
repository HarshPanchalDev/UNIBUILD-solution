// Password hashing (scrypt) and token helpers — Node's built-in crypto, no extra dependency.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, createHmac, randomInt } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, n, r, p, saltB64, keyB64] = stored.split("$");
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return expected.length === key.length && timingSafeEqual(expected, key);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set (at least 32 characters)");
    return "dev-only-secret-change-me-dev-only-secret";
  }
  return s;
}

/** OTP codes are stored as HMAC(secret, mobile:purpose:code), never in plain text. */
export const hashOtp = (mobile, purpose, code) => createHmac("sha256", secret()).update(`${mobile}:${purpose}:${code}`).digest("hex");

export const generateOtp = () => String(randomInt(0, 1000000)).padStart(6, "0");

export function safeEqualHex(a, b) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
