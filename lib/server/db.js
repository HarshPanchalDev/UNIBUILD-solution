import "server-only";
import { PrismaClient } from "@prisma/client";
import { createPrismaRepo } from "../repo/prisma.js";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__unibuildPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.__unibuildPrisma = prisma;

export const repo = createPrismaRepo(prisma);
