import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REQUEST_PATH_HEADER,
  SESSION_ABSOLUTE_SECONDS,
  SESSION_COOKIE,
  SESSION_IDLE_SECONDS,
  refreshSessionToken,
  verifySessionToken,
  type SessionClaims,
} from "@/lib/auth/session";
import { config, proxy } from "../proxy";

const T0 = new Date("2026-10-05T07:00:00Z");
const t0 = Math.floor(T0.getTime() / 1000);
const claims: SessionClaims = {
  uid: "cmgd3k2x40000qz8l5f1h2j3k",
  role: "ADMIN",
  sv: 1,
  iat: t0,
  exp: t0 + SESSION_IDLE_SECONDS,
  aexp: t0 + SESSION_ABSOLUTE_SECONDS,
};

/** A session token issued at T0 (refreshSessionToken signs with iat = now). */
async function tokenAtT0(): Promise<string> {
  vi.setSystemTime(T0);
  return refreshSessionToken(claims);
}

function req(path: string, o: { token?: string; method?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: o.method ?? "GET",
    headers: o.token ? { cookie: `${SESSION_COOKIE}=${o.token}` } : {},
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("proxy (/crm)", () => {
  it("runs only on /crm", () => {
    expect(config.matcher).toEqual(["/crm/:path*"]);
  });

  it("redirects visitors without a session to the login page, keeping the path", async () => {
    const res = await proxy(req("/crm/pacienti?q=ana"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/crm/login");
    expect(location.searchParams.get("next")).toBe("/crm/pacienti?q=ana");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("deletes an invalid session cookie while redirecting", async () => {
    const res = await proxy(req("/crm", { token: "nu.este.valid" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
  });

  it("lets the login page through, marked noindex", async () => {
    const res = await proxy(req("/crm/login?next=%2Fcrm"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("passes a valid session through and forwards the request path", async () => {
    const token = await tokenAtT0();
    const res = await proxy(req("/crm/programari?zi=2026-10-05", { token }));
    expect(res.status).toBe(200);
    expect(res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)).toBe("/crm/programari?zi=2026-10-05");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined(); // fresh token: no refresh
  });

  it("slides the idle timeout on reads after 30 minutes", async () => {
    const token = await tokenAtT0();
    vi.setSystemTime(new Date(T0.getTime() + 45 * 60_000));
    const res = await proxy(req("/crm", { token }));
    const refreshed = res.cookies.get(SESSION_COOKIE);
    expect(refreshed?.httpOnly).toBe(true);
    expect(refreshed?.sameSite).toBe("lax");
    const next = await verifySessionToken(refreshed?.value);
    expect(next?.iat).toBe(t0 + 45 * 60);
    expect(next?.exp).toBe(t0 + 45 * 60 + SESSION_IDLE_SECONDS);
    expect(next?.aexp).toBe(claims.aexp);
  });

  it("does not touch the cookie on POST (Server Actions manage it themselves)", async () => {
    const token = await tokenAtT0();
    vi.setSystemTime(new Date(T0.getTime() + 45 * 60_000));
    const res = await proxy(req("/crm/cont", { token, method: "POST" }));
    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("sends an expired session to the login page", async () => {
    const token = await tokenAtT0();
    vi.setSystemTime(new Date(T0.getTime() + (SESSION_IDLE_SECONDS + 60) * 1000));
    const res = await proxy(req("/crm/pacienti", { token }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("next")).toBe("/crm/pacienti");
  });
});
