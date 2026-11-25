import { NextResponse, type NextRequest } from "next/server";
import {
  REQUEST_PATH_HEADER,
  SESSION_COOKIE,
  refreshSessionToken,
  sessionCookieOptions,
  shouldRefreshSession,
  verifySessionToken,
} from "@/lib/auth/session";

/**
 * Proxy for /crm (docs/architecture.md §5.1). Optimistic only: it verifies the JWT without DB
 * access, sends visitors without a valid session to the login page, slides the idle timeout and
 * marks every CRM response as noindex and uncacheable. The DAL (`src/lib/auth/dal.ts`) remains
 * the real security boundary.
 */

const LOGIN_PATH = "/crm/login";

function withCrmHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  const isLogin = pathname === LOGIN_PATH;

  if (!claims && !isLogin) {
    const url = new URL(LOGIN_PATH, request.url);
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return withCrmHeaders(res);
  }

  // Forward the current path, so server code can build `?next=` and enforce password changes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATH_HEADER, `${pathname}${search}`);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Sliding idle timeout. Only on reads: a Server Action response may itself set or delete the cookie.
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (claims && isRead && shouldRefreshSession(claims)) {
    const refreshed = await refreshSessionToken(claims);
    const fresh = await verifySessionToken(refreshed);
    if (fresh) res.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions(fresh.exp));
  }

  return withCrmHeaders(res);
}

export const config = {
  matcher: ["/crm/:path*"],
};
