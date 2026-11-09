// End-to-end smoke test against a RUNNING app (npm run dev in another terminal).
// Usage:  node scripts/smoke.js [baseUrl] [ownerEmail] [ownerPassword]
// Defaults: http://localhost:3000  owner@example.com  Owner@12345
// Needs the demo data (npm run db:seed-demo) and DEV_SHOW_OTP="true" in .env for the partner login check.
import { readFile } from "node:fs/promises";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OWNER_EMAIL = process.argv[3] || "owner@example.com";
const OWNER_PASSWORD = process.argv[4] || "Owner@12345";
const PARTNER_MOBILE = "9826000001";

let pass = 0;
let fail = 0;
const results = [];
function check(name, ok, info = "") {
  if (ok) pass++;
  else fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  — ${info}` : ""}`);
  console.log(`${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${name}${info ? `  — ${info}` : ""}`);
}

async function call(path, { method = "GET", cookie, json, form } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (json) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: json ? JSON.stringify(json) : form, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const session = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("ub_session="));
  const type = res.headers.get("content-type") || "";
  const body = type.includes("json") ? await res.json().catch(() => ({})) : await res.text();
  return { status: res.status, body, session, type, location: res.headers.get("location") };
}

function fileForm(fields, fileName, content, mime = "text/csv") {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  f.set("file", new Blob([content], { type: mime }), fileName);
  return f;
}

async function main() {
  console.log(`Testing ${BASE}\n`);

  // 1. Server up
  let r = await call("/").catch((e) => ({ status: 0, body: e.message }));
  if (r.status === 0) {
    console.log(`\x1b[31mCannot reach ${BASE}. Is "npm run dev" running?\x1b[0m`);
    process.exit(1);
  }
  check("Landing page loads", r.status === 200, `status ${r.status}`);
  r = await call("/offline");
  check("Offline page loads", r.status === 200);
  r = await call("/manifest.webmanifest");
  check("PWA manifest", r.status === 200 && JSON.stringify(r.body).includes("UNIBUILD"));

  // 2. Security without login
  r = await call("/admin");
  check("Admin redirects to staff login when signed out", r.status === 307 || r.status === 308 || r.status === 302, `${r.status} → ${r.location ?? ""}`);
  r = await call("/api/admin/lookup?q=SAL");
  check("Admin API refuses anonymous user (401)", r.status === 401, `status ${r.status}`);

  // 3. Staff login
  r = await call("/api/auth/staff/login", { method: "POST", json: { identifier: OWNER_EMAIL, password: "wrong-password-123" } });
  check("Wrong staff password is refused", r.status === 401, r.body?.error);
  r = await call("/api/auth/staff/login", { method: "POST", json: { identifier: OWNER_EMAIL, password: OWNER_PASSWORD } });
  const staff = r.session;
  check("Owner can sign in", r.status === 200 && Boolean(staff), r.body?.error ?? (r.body?.otpRequired ? "STAFF_OTP_REQUIRED is on — turn it off for this test" : ""));
  if (!staff) return finish();

  // 4. Admin pages render
  for (const p of ["/admin", "/admin/uploads", "/admin/exceptions", "/admin/sites", "/admin/partners", "/admin/links", "/admin/links?tab=requests", "/admin/redemptions", "/admin/rewards", "/admin/reports", "/admin/reports?tab=linked-share", "/admin/settings", "/admin/staff", "/admin/audit-log", "/admin/search?q=SAL"]) {
    r = await call(p, { cookie: staff });
    check(`Page ${p}`, r.status === 200 && !String(r.body).includes("This page could not load"), `status ${r.status}`);
  }

  // 5. Uploads
  const invoiceCsv = await readFile(new URL("../samples/paid_invoices_sample.csv", import.meta.url), "utf8");
  r = await call("/api/admin/uploads", { method: "POST", cookie: staff, form: fileForm({ kind: "INVOICE", mode: "preview" }, "paid_invoices_sample.csv", invoiceCsv) });
  check("Upload preview reads the sample file", r.status === 200 && r.body.preview?.ok === true, `${r.body.preview?.lines ?? "?"} lines`);
  r = await call("/api/admin/uploads", { method: "POST", cookie: staff, form: fileForm({ kind: "INVOICE", mode: "process" }, "paid_invoices_sample.csv", invoiceCsv) });
  const s = r.body.summary ?? {};
  check("Same invoices uploaded again are skipped (no double points)", r.status === 200 && s.documentsSkipped >= 1 && s.pointsCredited === 0, `skipped ${s.documentsSkipped}, credited ${s.pointsCredited}`);
  const broken = await readFile(new URL("../samples/paid_invoices_missing_category.csv", import.meta.url), "utf8");
  r = await call("/api/admin/uploads", { method: "POST", cookie: staff, form: fileForm({ kind: "INVOICE", mode: "process" }, "missing_category.csv", broken) });
  check("File without Category column is rejected and the column named", r.body.rejected === true && (r.body.missing ?? []).includes("Category"), r.body.error);
  r = await call("/api/admin/uploads", { method: "POST", cookie: staff, form: fileForm({ kind: "INVOICE", mode: "preview" }, "notes.txt", "hello") });
  check("Wrong file type is refused", r.status === 400, r.body?.error);

  // 6. Lookups, reports, templates
  r = await call("/api/admin/lookup?type=site&q=SAL", { cookie: staff });
  check("Site search works", r.status === 200 && (r.body.sites ?? []).length > 0, `${(r.body.sites ?? []).length} sites`);
  r = await call("/api/admin/reports/points?format=xlsx", { cookie: staff });
  check("Report Excel export", r.status === 200 && r.type.includes("spreadsheetml"), r.type);
  r = await call("/api/admin/templates/paid-invoices", { cookie: staff });
  check("Sample template download", r.status === 200 && r.type.includes("spreadsheetml"));

  // 7. Validation
  r = await call("/api/admin/links", { method: "POST", cookie: staff, json: { siteId: 1, partnerId: 1, reason: "" } });
  check("Link without a reason is refused", r.status === 400, r.body?.error);
  r = await call("/api/admin/settings", { method: "PUT", cookie: staff, json: { values: { lockDays: -5 } } });
  check("Invalid settings are refused", r.status === 400, r.body?.error);

  // 8. Partner login (dev OTP)
  r = await call("/api/auth/otp", { method: "POST", json: { identifier: "9000000000", purpose: "login" } });
  check("Unknown mobile is told to register", r.status === 404, r.body?.error);
  r = await call("/api/auth/otp", { method: "POST", json: { identifier: PARTNER_MOBILE, purpose: "login" } });
  const otp = r.body?.devOtp;
  check("OTP sent to demo partner", r.status === 200, otp ? "dev code received" : r.body?.error ?? 'set DEV_SHOW_OTP="true" in .env to test partner login');
  if (otp) {
    const wrong = otp === "000000" ? "111111" : "000000";
    r = await call("/api/auth/partner/login", { method: "POST", json: { identifier: PARTNER_MOBILE, code: wrong } });
    check("Wrong OTP is refused", r.status === 400 || r.status === 401, r.body?.error);
    r = await call("/api/auth/partner/login", { method: "POST", json: { identifier: PARTNER_MOBILE, code: otp } });
    const partner = r.session;
    check("Partner can sign in with OTP", r.status === 200 && Boolean(partner), r.body?.error);
    if (partner) {
      for (const p of ["/partner", "/partner/points", "/partner/sites", "/partner/rewards", "/partner/redemptions", "/partner/notices", "/partner/profile"]) {
        r = await call(p, { cookie: partner });
        check(`Partner page ${p}`, r.status === 200, `status ${r.status}`);
      }
      r = await call("/partner/points", { cookie: partner });
      const html = String(r.body);
      check("Partner never sees invoice amounts or owner phones", !/₹\s?1,50,000|38,000|9893010001|Mohan Sharma/.test(html));
      r = await call("/api/admin/lookup?q=SAL", { cookie: partner });
      check("Partner cannot use admin API (403)", r.status === 403, `status ${r.status}`);
      r = await call("/api/partner/redemptions", { method: "POST", cookie: partner, json: { rewardId: 999999 } });
      check("Redeeming a missing reward is refused", r.status === 400, r.body?.error);
      r = await call("/api/auth/logout", { method: "POST", cookie: partner });
      r = await call("/api/partner/notices", { method: "POST", cookie: partner, json: { all: true } });
      check("Session is gone after logout", r.status === 401, `status ${r.status}`);
    }
  }
  finish();
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log("Copy the FAIL lines above and send them.");
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("\nSmoke test crashed:", e);
  process.exit(1);
});
