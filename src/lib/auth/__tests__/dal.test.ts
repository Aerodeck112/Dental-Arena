import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);

import { expectRedirect, getCookie, request, resetRequest, setRequestCookie } from "@/lib/__tests__/helpers/next-request";
import { uniqueTag } from "@/lib/__tests__/helpers/test-db";
import { prisma } from "../../db";
import { getCurrentUser, requirePermission, requireUser } from "../dal";
import { SESSION_COOKIE, createSession } from "../session";

const tag = uniqueTag("dal");
const ids: { receptie: string; medic: string; doctor: string } = { receptie: "", medic: "", doctor: "" };

/** Signs a session for the user as it is now in the DB and sends it with the next request. */
async function signIn(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await createSession({ id: u.id, role: u.role, sessionVersion: u.sessionVersion });
  const token = getCookie(SESSION_COOKIE)!.value;
  resetRequest({ "x-da-path": "/crm/pacienti?q=ana" });
  setRequestCookie(SESSION_COOKIE, token);
}

beforeAll(async () => {
  const receptie = await prisma.user.create({
    data: { email: `${tag}-r@example.com`, passwordHash: "x", role: "RECEPTIE", firstName: "Ioana", lastName: "Man" },
  });
  const medic = await prisma.user.create({
    data: { email: `${tag}-m@example.com`, passwordHash: "x", role: "MEDIC", firstName: "Andrei", lastName: "Test" },
  });
  const doctor = await prisma.doctor.create({
    data: {
      userId: medic.id,
      slug: tag,
      firstName: "Andrei",
      lastName: "Test",
      publicName: "Dr. Andrei Test",
      roleLine: "Medic dentist",
    },
  });
  Object.assign(ids, { receptie: receptie.id, medic: medic.id, doctor: doctor.id });
});

afterAll(async () => {
  await prisma.doctor.deleteMany({ where: { slug: tag } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
});

beforeEach(async () => {
  resetRequest({ "x-da-path": "/crm/pacienti?q=ana" });
  await prisma.user.updateMany({
    where: { email: { startsWith: tag } },
    data: { active: true, lockedUntil: null, mustChangePassword: false },
  });
});

describe("getCurrentUser", () => {
  it("returns null without a cookie or with a forged one", async () => {
    expect(await getCurrentUser()).toBeNull();
    setRequestCookie(SESSION_COOKIE, "nu.este.jwt");
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns a DTO for a valid session", async () => {
    await signIn(ids.receptie);
    expect(await getCurrentUser()).toEqual({
      id: ids.receptie,
      role: "RECEPTIE",
      email: `${tag}-r@example.com`,
      firstName: "Ioana",
      lastName: "Man",
      displayName: "Ioana Man",
      doctorId: null,
      homeLocationId: null,
      locationIds: [],
      theme: "SISTEM",
      density: "COMPACT",
      mustChangePassword: false,
    });
  });

  it("uses the doctor's public name and id for a MEDIC", async () => {
    await signIn(ids.medic);
    const user = await getCurrentUser();
    expect(user?.displayName).toBe("Dr. Andrei Test");
    expect(user?.doctorId).toBe(ids.doctor);
  });

  it("is invalidated on the next request when sessionVersion is bumped", async () => {
    await signIn(ids.receptie);
    expect(await getCurrentUser()).not.toBeNull();
    await prisma.user.update({ where: { id: ids.receptie }, data: { sessionVersion: { increment: 1 } } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("rejects deactivated and locked accounts", async () => {
    await signIn(ids.receptie);
    await prisma.user.update({ where: { id: ids.receptie }, data: { active: false } });
    expect(await getCurrentUser()).toBeNull();
    await prisma.user.update({
      where: { id: ids.receptie },
      data: { active: true, lockedUntil: new Date(Date.now() + 15 * 60_000) },
    });
    expect(await getCurrentUser()).toBeNull();
    await prisma.user.update({ where: { id: ids.receptie }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect(await getCurrentUser()).not.toBeNull();
  });

  it("rejects a session whose user was deleted", async () => {
    const temp = await prisma.user.create({
      data: { email: `${tag}-tmp@example.com`, passwordHash: "x", role: "ADMIN", firstName: "T", lastName: "T" },
    });
    await signIn(temp.id);
    await prisma.user.delete({ where: { id: temp.id } });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireUser and requirePermission", () => {
  it("redirects to the login page with the current path as next", async () => {
    expect(await expectRedirect(() => requireUser())).toBe("/crm/login?next=%2Fcrm%2Fpacienti%3Fq%3Dana");
  });

  it("does not loop back to the login page", async () => {
    request.headers.set("x-da-path", "/crm/login");
    expect(await expectRedirect(() => requireUser())).toBe("/crm/login");
  });

  it("forces a password change everywhere except /crm/cont", async () => {
    await prisma.user.update({ where: { id: ids.receptie }, data: { mustChangePassword: true } });
    await signIn(ids.receptie);
    expect(await expectRedirect(() => requireUser())).toBe("/crm/cont?schimbare=1");
    request.headers.set("x-da-path", "/crm/cont?schimbare=1");
    expect((await requireUser()).id).toBe(ids.receptie);
  });

  it("sends users without the permission to /crm/acces-interzis", async () => {
    await signIn(ids.medic);
    expect(await expectRedirect(() => requirePermission("audit.view"))).toBe("/crm/acces-interzis");
    expect(await expectRedirect(() => requirePermission(["leads.view", "billing.view"]))).toBe("/crm/acces-interzis");
    expect((await requirePermission(["appointments.manage", "appointments.manageOwn"])).id).toBe(ids.medic);
  });
});
