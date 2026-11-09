import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "../loyalty/errors.js";

/** Block cross-site form posts: the Origin of a state-changing request must match this host. */
function checkOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetch from older browsers; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("BAD_ORIGIN", "Request blocked", 403);
  }
  if (originHost !== host) throw new AppError("BAD_ORIGIN", "Request blocked", 403);
}

export function errorResponse(e) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message, code: e.code, details: e.details ?? null }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const fields = {};
    for (const issue of e.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    return NextResponse.json({ error: "Please check the highlighted fields", code: "INVALID", details: fields }, { status: 400 });
  }
  if (e?.code === "P2002") {
    return NextResponse.json({ error: "This record already exists", code: "CONFLICT" }, { status: 409 });
  }
  if (e?.code === "P2025") {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }
  console.error("[api] unexpected error", e);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "SERVER_ERROR" }, { status: 500 });
}

/** Wrap a route handler: origin check, JSON response, consistent errors. */
export function api(fn) {
  return async (req, ctx) => {
    try {
      checkOrigin(req);
      const params = ctx?.params ? await ctx.params : {};
      const result = await fn(req, params);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson(req, schema) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new AppError("INVALID", "Invalid request body", 400);
  }
  return schema ? schema.parse(body) : body;
}

export const idParam = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new AppError("INVALID", "Invalid id", 400);
  return n;
};
