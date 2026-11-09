// Production-safe seed: first Owner account (+ optional Store Manager) and default settings.
// Run: npm run db:seed     (idempotent — safe to run again)
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/server/crypto.js";
import { DEFAULT_SETTINGS } from "../lib/loyalty/settings.js";

const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === "production";

function need(name, devDefault) {
  const v = process.env[name];
  if (v) return v;
  if (isProd || devDefault === undefined) throw new Error(`Set ${name} in .env before seeding`);
  return devDefault;
}

async function upsertStaff({ name, email, mobile, role, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ✓ ${role} ${email} already exists (password not changed)`);
    return existing;
  }
  const u = await prisma.user.create({ data: { name, email, mobile: mobile || null, role, passwordHash: await hashPassword(password) } });
  console.log(`  + created ${role} ${email}`);
  return u;
}

async function main() {
  console.log("Seeding UNIBUILD Partner App…");
  const ownerPassword = need("SEED_OWNER_PASSWORD", "Owner@12345");
  if (ownerPassword.length < 10) throw new Error("SEED_OWNER_PASSWORD must be at least 10 characters");
  await upsertStaff({
    name: need("SEED_OWNER_NAME", "UNIBUILD Owner"),
    email: need("SEED_OWNER_EMAIL", "owner@unibuild.local").toLowerCase(),
    mobile: process.env.SEED_OWNER_MOBILE,
    role: "OWNER",
    password: ownerPassword,
  });
  if (process.env.SEED_MANAGER_EMAIL || !isProd) {
    await upsertStaff({
      name: process.env.SEED_MANAGER_NAME || "Store Manager",
      email: (process.env.SEED_MANAGER_EMAIL || "manager@unibuild.local").toLowerCase(),
      mobile: process.env.SEED_MANAGER_MOBILE,
      role: "STORE_MANAGER",
      password: need("SEED_MANAGER_PASSWORD", "Manager@12345"),
    });
  }
  if (!(await prisma.settingsVersion.findFirst())) {
    await prisma.settingsVersion.create({ data: { values: DEFAULT_SETTINGS, note: "Default settings (spec v0.1)" } });
    console.log("  + default settings version");
  }
  const staff = await prisma.user.findMany({ where: { role: { in: ["OWNER", "STORE_MANAGER"] } }, select: { email: true, role: true } });
  console.log("\n  Staff sign-in emails (/staff/login):");
  for (const u of staff) console.log(`   - ${u.role}: ${u.email}`);
  if (!isProd) console.log("  Development passwords (if not set in .env): Owner@12345 / Manager@12345");
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
