import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);

import { expectRedirect, getCookie, resetRequest } from "@/lib/__tests__/helpers/next-request";
import { uniqueTag } from "@/lib/__tests__/helpers/test-db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { login } from "../actions";

const tag = uniqueTag("login");
const email = `${tag}@example.com`;
const PASSWORD = "Cireșe-roșii-la-Luduș";
const GENERIC = { ok: false, code: "UNAUTHENTICATED", error: "E-mailul sau parola nu sunt corecte." };
const RATE_LIMITED = {
  ok: false,
  code: "RATE_LIMITED",
  error: "Ați trimis prea multe cereri. Încercați din nou peste câteva minute sau sunați-ne.",
};
let userId = "";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Clears the login rate-limit buckets (only this test file uses them in test-wp1.db). */
async function clearLimits() {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "login:" } } });
}

beforeAll(async () => {
  // Cost 4 keeps the test fast; production hashes use cost 12 (see password.test.ts).
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(PASSWORD, 4), role: "RECEPTIE", firstName: "Ioana", lastName: "Login" },
  });
  userId = user.id;
});

afterAll(async () => {
  await clearLimits();
  await prisma.auditLog.deleteMany({ where: { entityId: userId } });
  await prisma.user.deleteMany({ where: { email } });
});

beforeEach(async () => {
  resetRequest({ "x-forwarded-for": "203.0.113.10" });
  await clearLimits();
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: 0, lockedUntil: null, active: true, mustChangePassword: false, lastLoginAt: null },
  });
});

describe("login", () => {
  it("signs in, sets the session cookie and redirects to /crm", async () => {
    expect(await expectRedirect(() => login(form({ email, password: PASSWORD })))).toBe("/crm");
    const claims = await verifySessionToken(getCookie(SESSION_COOKIE)?.value);
    expect(claims?.uid).toBe(userId);
    expect(claims?.role).toBe("RECEPTIE");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.failedLogins).toBe(0);
    expect(row.lastLoginAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: userId, action: "auth.login" } })).toBeGreaterThan(0);
  });

  it("accepts the e-mail in any case and works through useActionState", async () => {
    expect(await expectRedirect(() => login(null, form({ email: email.toUpperCase(), password: PASSWORD })))).toBe("/crm");
  });

  it("returns to a same-origin /crm path only", async () => {
    expect(await expectRedirect(() => login(form({ email, password: PASSWORD, next: "/crm/pacienti?q=ana" })))).toBe(
      "/crm/pacienti?q=ana",
    );
    for (const next of ["//evil.example/crm", "https://evil.example/crm", "/crm/login", "/despre-noi"]) {
      expect(await expectRedirect(() => login(form({ email, password: PASSWORD, next })))).toBe("/crm");
      await clearLimits();
    }
  });

  it("shows one generic message for a wrong password or an unknown e-mail", async () => {
    expect(await login(form({ email, password: "parola-gresita-123" }))).toEqual(GENERIC);
    expect(await login(form({ email: `nimeni-${tag}@example.com`, password: PASSWORD }))).toEqual(GENERIC);
    expect(getCookie(SESSION_COOKIE)).toBeUndefined();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.failedLogins).toBe(1);
    const failed = await prisma.auditLog.findFirst({ where: { entityId: userId, action: "auth.failed" } });
    expect(JSON.parse(failed?.metadata ?? "{}")).toEqual({ reason: "parola-gresita" });
  });

  it("validates the form", async () => {
    const r = await login(form({ email: "nu-e-email", password: "" }));
    expect(r.ok === false && r.code).toBe("VALIDATION");
    expect(r.ok === false && Object.keys(r.fieldErrors ?? {}).sort()).toEqual(["email", "password"]);
  });

  it("locks the account for 15 minutes after 10 failures", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect(await login(form({ email, password: `gresit-${i}-abcdef` }))).toEqual(GENERIC);
      await clearLimits();
    }
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(locked.lockedUntil).not.toBeNull();
    const minutes = (locked.lockedUntil!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    // Even the right password is refused while locked, with the same message.
    expect(await login(form({ email, password: PASSWORD }))).toEqual(GENERIC);
    expect(getCookie(SESSION_COOKIE)).toBeUndefined();

    // Once the lock has passed, the right password works again.
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await clearLimits();
    expect(await expectRedirect(() => login(form({ email, password: PASSWORD })))).toBe("/crm");
  });

  it("allows 5 attempts per e-mail in 15 minutes, from any IP, then shows the rate-limit message", async () => {
    for (let i = 0; i < 5; i += 1) {
      resetRequest({ "x-forwarded-for": `203.0.113.${20 + i}` });
      expect(await login(form({ email, password: `gresit-${i}-abcdef` }))).toEqual(GENERIC);
    }
    resetRequest({ "x-forwarded-for": "203.0.113.99" });
    expect(await login(form({ email, password: PASSWORD }))).toEqual(RATE_LIMITED);
    expect(getCookie(SESSION_COOKIE)).toBeUndefined();
    const bucket = await prisma.rateLimitBucket.findFirst({ where: { key: { startsWith: "login:email:" } } });
    expect(bucket?.key).not.toContain(tag); // the e-mail is stored hashed
  });

  it("refuses deactivated accounts with the generic message", async () => {
    await prisma.user.update({ where: { id: userId }, data: { active: false } });
    expect(await login(form({ email, password: PASSWORD }))).toEqual(GENERIC);
  });

  it("sends users who must change their password to /crm/cont", async () => {
    await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
    expect(await expectRedirect(() => login(form({ email, password: PASSWORD, next: "/crm/pacienti" })))).toBe(
      "/crm/cont?schimbare=1",
    );
  });
});
