import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/shared/auth/session";

/**
 * The login gate in front of everything. Every request needs a valid session
 * cookie except the login page itself and the webhook, which carries its own
 * API key. A page request without one is sent to the login form (remembering
 * where it was going); an API request gets a 401 instead of an HTML redirect.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/webhooks/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

// Run on every path except Next's internals and files with an extension
// (static assets). The webhook and login are matched, then allowed above.
export const config = {
  matcher: ["/((?!_next/|.*\\.).*)"],
};
