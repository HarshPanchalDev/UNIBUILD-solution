import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { checkStaffPassword, createSession, verifyOtp } from "@/lib/server/auth";

const schema = z.object({ identifier: z.string().trim().min(3).max(160), password: z.string().min(1).max(200), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export const POST = api(async (req) => {
  const { identifier, password, code } = await readJson(req, schema);
  const user = await checkStaffPassword(identifier, password);
  await verifyOtp(user.mobile, "STAFF_LOGIN", code);
  await createSession(user);
  return { ok: true, redirect: "/admin" };
});
