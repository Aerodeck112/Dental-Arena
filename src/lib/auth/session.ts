import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/generated/prisma/enums";
import { deriveKey } from "../crypto";
import { env } from "../env";

/**
 * Stateless session cookie (docs/architecture.md §5.1).
 *
 * `da_session` holds an HS256 JWT signed with HMAC(AUTH_SECRET, "session"). The idle timeout is
 * 8 hours (`exp`, slid forward by the proxy), the absolute limit 12 hours after login (`aexp`).
 * The JWT alone is never trusted for access: the DAL re-checks the user and `sessionVersion`.
 * This file does no DB access, so `src/proxy.ts` can use it.
 */

export const SESSION_COOKIE = "da_session";
export const SESSION_IDLE_SECONDS = 8 * 60 * 60;
export const SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;
/** Request header the proxy sets on /crm requests: the current path plus query string. */
export const REQUEST_PATH_HEADER = "x-da-path";
/** The proxy re-signs a token older than this (sliding idle timeout). */
export const SESSION_REFRESH_AFTER_SECONDS = 30 * 60;

const ROLES: readonly Role[] = ["ADMIN", "MEDIC", "RECEPTIE"];

export type SessionClaims = { uid: string; role: Role; sv: number; iat: number; exp: number; aexp: number };

let sessionKey: Uint8Array | null = null;
function key(): Uint8Array {
  sessionKey ??= new Uint8Array(deriveKey(env.AUTH_SECRET, "session"));
  return sessionKey;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function sign(c: SessionClaims): Promise<string> {
  return new SignJWT({ uid: c.uid, role: c.role, sv: c.sv, aexp: c.aexp })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(c.iat)
    .setExpirationTime(c.exp)
    .sign(key());
}

/** Cookie attributes for a token that expires at `exp` (unix seconds). */
export function sessionCookieOptions(exp: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, exp - nowSeconds()),
  };
}

/** Signs a fresh session and sets the cookie. Server Actions and Route Handlers only. */
export async function createSession(u: { id: string; role: Role; sessionVersion: number }): Promise<void> {
  const iat = nowSeconds();
  const claims: SessionClaims = {
    uid: u.id,
    role: u.role,
    sv: u.sessionVersion,
    iat,
    exp: iat + SESSION_IDLE_SECONDS,
    aexp: iat + SESSION_ABSOLUTE_SECONDS,
  };
  const token = await sign(claims);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(claims.exp));
}

/** Deletes the session cookie. Server Actions and Route Handlers only. */
export async function deleteSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

/** Verifies signature, expiry and the absolute limit. Returns null for anything invalid. */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { uid, role, sv, iat, exp, aexp } = payload as Record<string, unknown>;
    if (
      typeof uid !== "string" ||
      typeof role !== "string" ||
      !ROLES.includes(role as Role) ||
      typeof sv !== "number" ||
      typeof iat !== "number" ||
      typeof exp !== "number" ||
      typeof aexp !== "number"
    ) {
      return null;
    }
    if (aexp <= nowSeconds()) return null;
    return { uid, role: role as Role, sv, iat, exp, aexp };
  } catch {
    return null;
  }
}

/** Re-signs the session with a new `iat` and `exp = min(now + 8h, aexp)`. Used by the proxy. */
export async function refreshSessionToken(c: SessionClaims): Promise<string> {
  const iat = nowSeconds();
  return sign({ ...c, iat, exp: Math.min(iat + SESSION_IDLE_SECONDS, c.aexp) });
}

/** True when the proxy should slide the session forward. */
export function shouldRefreshSession(c: SessionClaims): boolean {
  return nowSeconds() - c.iat >= SESSION_REFRESH_AFTER_SECONDS && c.exp < c.aexp;
}
