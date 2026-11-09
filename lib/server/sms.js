import "server-only";
import { AppError } from "../loyalty/errors.js";

// Shown to the person signing in; the technical reason goes to the server log.
const notReady = (why) => {
  console.error(`[SMS] ${why}`);
  return new AppError("SMS_UNAVAILABLE", "SMS codes cannot be sent right now. Please contact UNIBUILD.", 503);
};

// SMS provider. Configure with env:
//   SMS_PROVIDER=msg91  MSG91_AUTH_KEY=…  MSG91_OTP_TEMPLATE_ID=…   (DLT-approved template with ##OTP##)
//   SMS_PROVIDER=console  -> DEVELOPMENT ONLY: the OTP is printed in the server log (and shown on screen if DEV_SHOW_OTP=true).
// NOT VERIFIED: the MSG91 call follows MSG91's OTP API docs but has not been tested with real credentials.

/** STAGING_MODE="true" = a hosted DEMO server (fake data, codes on screen, banner on every page). Never on the live app. */
export const stagingMode = () => process.env.STAGING_MODE === "true";

export function smsMode() {
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();
  const isProd = process.env.NODE_ENV === "production";
  if (provider === "console" && isProd && !stagingMode() && process.env.ALLOW_CONSOLE_OTP_IN_PRODUCTION !== "true") {
    throw notReady("SMS_PROVIDER=console is not allowed in production. Configure MSG91 (see README).");
  }
  return provider;
}

/** True when OTPs may be shown on screen (development, or a STAGING_MODE demo server — never the live app). */
export const devShowOtp = () =>
  (process.env.NODE_ENV !== "production" && process.env.DEV_SHOW_OTP === "true") || (stagingMode() && (process.env.SMS_PROVIDER || "console").toLowerCase() === "console");

export async function sendOtpSms(mobile, code) {
  const provider = smsMode();
  if (provider === "console") {
    console.info(`[DEV OTP] ${mobile}: ${code}`);
    return { delivered: false, dev: true };
  }
  if (provider === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
    if (!authKey || !templateId) throw notReady("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID must be set");
    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.searchParams.set("template_id", templateId);
    url.searchParams.set("mobile", `91${mobile}`);
    url.searchParams.set("otp", code);
    const res = await fetch(url, { method: "POST", headers: { authkey: authKey, "content-type": "application/json" }, body: "{}" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.type === "error") {
      console.error("MSG91 OTP failed", res.status, body);
      throw new AppError("SMS_FAILED", "Could not send the SMS. Please try again.", 502);
    }
    return { delivered: true };
  }
  throw notReady(`Unknown SMS_PROVIDER: ${provider}`);
}
