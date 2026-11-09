import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { checkStaffPassword, createSession, issueOtp, staffOtpRequired } from "@/lib/server/auth";
import { AppError } from "@/lib/loyalty/errors";

const schema = z.object({ identifier: z.string().trim().min(3).max(160), password: z.string().min(1).max(200) });

export const POST = api(async (req) => {
  const { identifier, password } = await readJson(req, schema);
  const user = await checkStaffPassword(identifier, password);
  if (staffOtpRequired()) {
    if (!user.mobile) throw new AppError("NO_MOBILE", "This staff account has no mobile number for the one-time code. Ask the Owner to add one.", 400);
    const res = await issueOtp(user.mobile, "STAFF_LOGIN");
    return { ok: true, otpRequired: true, sentTo: `+91 ••••••${user.mobile.slice(-4)}`, ...res };
  }
  await createSession(user);
  return { ok: true, redirect: "/admin" };
});
