import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { expectRedirect, getCookie, resetRequest, setRequestCookie } from "@/lib/__tests__/helpers/next-request";
import { uniqueTag } from "@/lib/__tests__/helpers/test-db";
import { SESSION_COOKIE, createSession } from "@/lib/auth/session";
import { CLINIC_SCOPE_COOKIE } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { logout, setClinicScope, setThemePreference } from "../actions";
import { NAV_ITEMS, isNavItemActive, navItemsFor } from "../nav";

describe("sidebar items (nav.ts)", () => {
  const labels = (role: "ADMIN" | "MEDIC" | "RECEPTIE") => navItemsFor({ role }).map((i) => i.label);

  it("lists every module for ADMIN, in the §11 order", () => {
    expect(labels("ADMIN")).toEqual([
      "Azi",
      "Calendar",
      "Cereri online",
      "Pacienți",
      "De rechemat",
      "Încasări",
      "Facturi",
      "Servicii și prețuri",
      "Echipă",
      "Absențe",
      "Locații",
      "Mesaje",
      "Rapoarte",
      "GDPR",
      "Audit",
      "Setări",
    ]);
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/crm",
      "/crm/programari",
      "/crm/cereri",
      "/crm/pacienti",
      "/crm/rechemari",
      "/crm/incasari",
      "/crm/facturi",
      "/crm/servicii",
      "/crm/echipa",
      "/crm/absente",
      "/crm/locatii",
      "/crm/mesaje",
      "/crm/rapoarte",
      "/crm/gdpr",
      "/crm/audit",
      "/crm/setari",
    ]);
  });

  it("hides Cereri, Încasări, Facturi, Setări, Audit and GDPR from MEDIC", () => {
    const medic = labels("MEDIC");
    for (const hidden of ["Cereri online", "Încasări", "Facturi", "Setări", "Audit", "GDPR", "Mesaje"]) {
      expect(medic).not.toContain(hidden);
    }
    expect(medic).toEqual(expect.arrayContaining(["Azi", "Calendar", "Pacienți", "De rechemat", "Rapoarte"]));
  });

  it("shows RECEPTIE the front-desk modules but not GDPR, Audit or Setări", () => {
    const receptie = labels("RECEPTIE");
    expect(receptie).toEqual(expect.arrayContaining(["Cereri online", "Încasări", "Facturi", "Mesaje", "Rapoarte"]));
    for (const hidden of ["GDPR", "Audit", "Setări"]) expect(receptie).not.toContain(hidden);
  });

  it("carries the count badges", () => {
    expect(NAV_ITEMS.find((i) => i.href === "/crm/cereri")?.count).toBe("leadsNew");
    expect(NAV_ITEMS.find((i) => i.href === "/crm/rechemari")?.count).toBe("recallsDue");
  });

  it("marks the active item", () => {
    const azi = NAV_ITEMS[0];
    const pacienti = NAV_ITEMS.find((i) => i.href === "/crm/pacienti")!;
    expect(isNavItemActive(azi, "/crm")).toBe(true);
    expect(isNavItemActive(azi, "/crm/pacienti")).toBe(false);
    expect(isNavItemActive(pacienti, "/crm/pacienti/abc")).toBe(true);
    expect(isNavItemActive(pacienti, "/crm/pacientii")).toBe(false);
  });
});

describe("shell actions", () => {
  const tag = uniqueTag("shell");
  let userId = "";

  async function signIn() {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await createSession({ id: u.id, role: u.role, sessionVersion: u.sessionVersion });
    const token = getCookie(SESSION_COOKIE)!.value;
    resetRequest();
    setRequestCookie(SESSION_COOKIE, token);
  }

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `${tag}@example.com`, passwordHash: "x", role: "MEDIC", firstName: "Paul", lastName: "Shell" },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  beforeEach(() => {
    resetRequest();
  });

  it("persists the clinic switch in the da_clinica cookie", async () => {
    await signIn();
    expect(await setClinicScope({ scope: "ludus" })).toEqual({ ok: true, data: { scope: "ludus" } });
    const cookie = getCookie(CLINIC_SCOPE_COOKIE);
    expect(cookie?.value).toBe("ludus");
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.options.maxAge).toBeGreaterThan(30 * 24 * 60 * 60);
  });

  it("rejects an unknown clinic and anonymous callers", async () => {
    await signIn();
    expect(await setClinicScope({ scope: "cluj" as "ludus" })).toMatchObject({ ok: false, code: "VALIDATION" });
    resetRequest();
    expect(await setClinicScope({ scope: "ludus" })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("saves the theme on the account", async () => {
    await signIn();
    expect((await setThemePreference({ theme: "INTUNECAT" })).ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).theme).toBe("INTUNECAT");
  });

  it("logout clears the cookie, audits and returns to the login page", async () => {
    await signIn();
    expect(await expectRedirect(() => logout(new FormData()))).toBe("/crm/login");
    const cookie = getCookie(SESSION_COOKIE);
    expect(cookie?.value).toBe("");
    expect(cookie?.options.maxAge).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: userId, action: "auth.logout" } })).toBe(1);
  });

  it("logout also clears a stale cookie", async () => {
    setRequestCookie(SESSION_COOKIE, "expirat");
    expect(await expectRedirect(() => logout({}))).toBe("/crm/login");
    expect(getCookie(SESSION_COOKIE)?.value).toBe("");
  });
});
