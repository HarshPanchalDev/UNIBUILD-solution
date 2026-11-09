import { NextResponse } from "next/server";

// Fast redirect when there is no session cookie at all. The real check (valid session, role)
// happens on the server in every page and API route (lib/server/auth.js).
export function middleware(req) {
  const has = req.cookies.has("ub_session");
  const { pathname } = req.nextUrl;
  if (!has && pathname.startsWith("/partner")) return NextResponse.redirect(new URL("/login", req.url));
  if (!has && pathname.startsWith("/admin")) return NextResponse.redirect(new URL("/staff/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/partner/:path*", "/admin/:path*"] };
