import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);

import { getCookie, resetRequest } from "@/lib/__tests__/helpers/next-request";
import { deriveKey } from "../../crypto";
import {
  SESSION_ABSOLUTE_SECONDS,
  SESSION_COOKIE,
  SESSION_IDLE_SECONDS,
  SESSION_REFRESH_AFTER_SECONDS,
  createSession,
  deleteSession,
  refreshSessionToken,
  shouldRefreshSession,
  verifySessionToken,
  type SessionClaims,
} from "../session";

const T0 = new Date("2026-10-05T07:00:00Z");
const t0 = Math.floor(T0.getTime() / 1000);
const sessionKey = new Uint8Array(deriveKey(process.env.AUTH_SECRET ?? "", "session"));

/** Signs arbitrary claims with the real session key (or another key). */
function sign(payload: Record<string, unknown>, o: { iat?: number; exp?: number; key?: Uint8Array } = {}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(o.iat ?? t0)
    .setExpirationTime(o.exp ?? t0 + SESSION_IDLE_SECONDS)
    .sign(o.key ?? sessionKey);
}

const user = { id: "cmgd3k2x40000qz8l5f1h2j3k", role: "RECEPTIE" as const, sessionVersion: 4 };

beforeEach(() => {
  resetRequest();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSession and deleteSession", () => {
  it("sets an httpOnly, SameSite=Lax cookie for 8 hours", async () => {
    await createSession(user);
    const cookie = getCookie(SESSION_COOKIE);
    expect(cookie?.options).toEqual({ httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
    const claims = await verifySessionToken(cookie?.value);
    expect(claims).toEqual({
      uid: user.id,
      role: "RECEPTIE",
      sv: 4,
      iat: t0,
      exp: t0 + SESSION_IDLE_SECONDS,
      aexp: t0 + SESSION_ABSOLUTE_SECONDS,
    });
  });

  it("logout clears the cookie", async () => {
    await createSession(user);
    await deleteSession();
    const cookie = getCookie(SESSION_COOKIE);
    expect(cookie?.value).toBe("");
    expect(cookie?.options.maxAge).toBe(0);
    expect(cookie?.options.path).toBe("/");
  });
});

describe("verifySessionToken", () => {
  it("rejects a missing token", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await sign({ uid: user.id, role: "RECEPTIE", sv: 4, aexp: t0 + SESSION_ABSOLUTE_SECONDS });
    const [header, payload, signature] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const forged = Buffer.from(JSON.stringify({ ...claims, role: "ADMIN" })).toString("base64url");
    expect(await verifySessionToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with another key, or unsigned", async () => {
    const otherKey = new Uint8Array(deriveKey("alt-secret-alt-secret-alt-secret-alt", "session"));
    expect(await verifySessionToken(await sign({ uid: user.id, role: "ADMIN", sv: 1, aexp: t0 + 3600 }, { key: otherKey }))).toBeNull();
    const none = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ uid: user.id, role: "ADMIN", sv: 1, iat: t0, exp: t0 + 3600, aexp: t0 + 3600 })).toString("base64url"),
      "",
    ].join(".");
    expect(await verifySessionToken(none)).toBeNull();
  });

  it("rejects an expired idle timeout", async () => {
    const token = await sign({ uid: user.id, role: "ADMIN", sv: 1, aexp: t0 + SESSION_ABSOLUTE_SECONDS });
    vi.setSystemTime(new Date(T0.getTime() + (SESSION_IDLE_SECONDS + 1) * 1000));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a token past its absolute limit even if exp was extended", async () => {
    const token = await sign({ uid: user.id, role: "ADMIN", sv: 1, aexp: t0 + 60 }, { exp: t0 + 3600 });
    vi.setSystemTime(new Date(T0.getTime() + 120_000));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects unknown roles and missing claims", async () => {
    expect(await verifySessionToken(await sign({ uid: user.id, role: "ROOT", sv: 1, aexp: t0 + 3600 }))).toBeNull();
    expect(await verifySessionToken(await sign({ uid: user.id, role: "ADMIN", aexp: t0 + 3600 }))).toBeNull();
    expect(await verifySessionToken(await sign({ role: "ADMIN", sv: 1, aexp: t0 + 3600 }))).toBeNull();
    expect(await verifySessionToken(await sign({ uid: user.id, role: "ADMIN", sv: 1 }))).toBeNull();
  });
});

describe("sliding idle timeout", () => {
  const claims: SessionClaims = {
    uid: user.id,
    role: "RECEPTIE",
    sv: 4,
    iat: t0,
    exp: t0 + SESSION_IDLE_SECONDS,
    aexp: t0 + SESSION_ABSOLUTE_SECONDS,
  };

  it("refreshes only tokens older than 30 minutes", () => {
    expect(SESSION_REFRESH_AFTER_SECONDS).toBe(30 * 60);
    vi.setSystemTime(new Date(T0.getTime() + 29 * 60_000));
    expect(shouldRefreshSession(claims)).toBe(false);
    vi.setSystemTime(new Date(T0.getTime() + 30 * 60_000));
    expect(shouldRefreshSession(claims)).toBe(true);
    expect(shouldRefreshSession({ ...claims, exp: claims.aexp })).toBe(false);
  });

  it("re-signs with a new iat and exp = now + 8h", async () => {
    vi.setSystemTime(new Date(T0.getTime() + 60 * 60_000));
    const refreshed = await verifySessionToken(await refreshSessionToken(claims));
    expect(refreshed).toEqual({ ...claims, iat: t0 + 3600, exp: t0 + 3600 + SESSION_IDLE_SECONDS });
  });

  it("never extends past the absolute limit (12 hours after login)", async () => {
    vi.setSystemTime(new Date(T0.getTime() + 10 * 60 * 60_000));
    const refreshed = await verifySessionToken(await refreshSessionToken(claims));
    expect(refreshed?.exp).toBe(claims.aexp);
    vi.setSystemTime(new Date(T0.getTime() + SESSION_ABSOLUTE_SECONDS * 1000));
    expect(await verifySessionToken(await refreshSessionToken(claims))).toBeNull();
  });
});
