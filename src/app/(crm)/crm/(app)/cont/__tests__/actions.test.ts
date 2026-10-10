import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { expectRedirect, getCookie, resetRequest, setRequestCookie } from "@/lib/__tests__/helpers/next-request";
import { uniqueTag } from "@/lib/__tests__/helpers/test-db";
import { getCurrentUser } from "@/lib/auth/dal";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, createSession, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { changePassword, updateAppearance, updateProfile } from "../actions";

const tag = uniqueTag("cont");
const email = `${tag}@example.com`;
const CURRENT = "Parola-actuala-de-test";
const NEW = "Cireșe-roșii-la-Luduș";
let userId = "";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Signs in as the test user (as stored now) and sends the cookie with the next request. */
async function signIn(): Promise<string> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await createSession({ id: u.id, role: u.role, sessionVersion: u.sessionVersion });
  const token = getCookie(SESSION_COOKIE)!.value;
  resetRequest({ "x-da-path": "/crm/cont" });
  setRequestCookie(SESSION_COOKIE, token);
  return token;
}

beforeAll(async () => {
  const u = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(CURRENT, 4), role: "RECEPTIE", firstName: "Elena", lastName: "Cont" },
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

beforeEach(async () => {
  resetRequest();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(CURRENT, 4), mustChangePassword: false },
  });
});

describe("/crm/cont: changePassword", () => {
  it("checks the current password", async () => {
    await signIn();
    const r = await changePassword(form({ currentPassword: "gresita", newPassword: NEW, confirmPassword: NEW }));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { currentPassword: ["Parola actuală nu este corectă."] } });
  });

  it("enforces the policy and the confirmation", async () => {
    await signIn();
    expect(await changePassword(form({ currentPassword: CURRENT, newPassword: "scurta", confirmPassword: "scurta" }))).toMatchObject({
      ok: false,
      fieldErrors: { newPassword: ["Parola trebuie să aibă cel puțin 10 caractere."] },
    });
    expect(
      await changePassword(form({ currentPassword: CURRENT, newPassword: "parola1234", confirmPassword: "parola1234" })),
    ).toMatchObject({ ok: false, fieldErrors: { newPassword: ["Parola este prea ușor de ghicit. Alegeți alta."] } });
    expect(await changePassword(form({ currentPassword: CURRENT, newPassword: email, confirmPassword: email }))).toMatchObject({
      ok: false,
      fieldErrors: { newPassword: ["Parola nu poate fi adresa de e-mail."] },
    });
    expect(await changePassword(form({ currentPassword: CURRENT, newPassword: NEW, confirmPassword: `${NEW}x` }))).toMatchObject({
      ok: false,
      fieldErrors: { confirmPassword: ["Parolele nu coincid. Scrieți aceeași parolă de două ori."] },
    });
    expect(await changePassword(form({ currentPassword: CURRENT, newPassword: CURRENT, confirmPassword: CURRENT }))).toMatchObject({
      ok: false,
      fieldErrors: { newPassword: ["Parola nouă trebuie să fie diferită de cea actuală."] },
    });
  });

  it("changes the password, revokes other sessions and keeps this device signed in", async () => {
    const oldToken = await signIn();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const r = await changePassword(form({ currentPassword: CURRENT, newPassword: NEW, confirmPassword: NEW }));
    expect(r).toEqual({ ok: true, data: null, message: "Parola a fost schimbată. Celelalte sesiuni au fost închise." });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await verifyPassword(NEW, after.passwordHash)).toBe(true);

    const fresh = getCookie(SESSION_COOKIE)!.value;
    expect((await verifySessionToken(fresh))?.sv).toBe(after.sessionVersion);

    // The old cookie (another device) no longer works; the new one does.
    resetRequest();
    setRequestCookie(SESSION_COOKIE, oldToken);
    expect(await getCurrentUser()).toBeNull();
    setRequestCookie(SESSION_COOKIE, fresh);
    expect((await getCurrentUser())?.id).toBe(userId);
  });

  it("goes to /crm after a forced change", async () => {
    await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
    await signIn();
    expect(
      await expectRedirect(() => changePassword(form({ currentPassword: CURRENT, newPassword: NEW, confirmPassword: NEW }))),
    ).toBe("/crm");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).mustChangePassword).toBe(false);
  });
});

describe("/crm/cont: appearance and profile", () => {
  it("saves the theme and the density", async () => {
    await signIn();
    expect(await updateAppearance(form({ theme: "INTUNECAT", density: "CONFORTABIL" }))).toEqual({
      ok: true,
      data: { theme: "INTUNECAT", density: "CONFORTABIL" },
      message: "Aspectul a fost salvat.",
    });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect([u.theme, u.density]).toEqual(["INTUNECAT", "CONFORTABIL"]);
    expect(await updateAppearance(form({ theme: "ROZ", density: "COMPACT" }))).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("saves the name and normalises the phone", async () => {
    await signIn();
    expect((await updateProfile(form({ firstName: " Elena ", lastName: "Cont", phone: "0744 123 456" }))).ok).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect([u.firstName, u.phone]).toEqual(["Elena", "+40744123456"]);
  });

  it("requires a signed-in user", async () => {
    expect(await updateAppearance(form({ theme: "LUMINOS", density: "COMPACT" }))).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});
