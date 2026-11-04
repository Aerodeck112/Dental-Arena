import { beforeAll, describe, expect, it, vi } from "vitest";

// This file controls the number of active admins, so it gets its own copy of the migrated test
// template instead of sharing test-wp8.db with the billing tests (SQLite allows one writer).
vi.hoisted(() => {
  const fs = process.getBuiltinModule("node:fs");
  for (const suffix of ["", "-journal"]) fs.rmSync(`prisma/test-wp8-staff.db${suffix}`, { force: true });
  fs.copyFileSync("prisma/test-template.db", "prisma/test-wp8-staff.db");
  process.env.DATABASE_URL = "file:./prisma/test-wp8-staff.db";
});

import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { setUserActive, updateUser } from "../service";

const tag = `stf${process.pid}${Date.now().toString(36)}`;
let adminId = "";
let otherId = "";

const actorOf = (id: string): CurrentUser => ({
  id,
  role: "ADMIN",
  email: `${id}@example.com`,
  firstName: "A",
  lastName: "B",
  displayName: "A B",
  doctorId: null,
  homeLocationId: null,
  locationIds: [],
  theme: "SISTEM",
  density: "COMPACT",
  mustChangePassword: false,
});

let locIds: string[] = [];

beforeAll(async () => {
  for (const [i, slug] of ["c", "l"].entries()) {
    await prisma.location.create({
      data: { slug: `${tag}-${slug}`, name: `Clinica ${slug}`, shortName: slug.toUpperCase(), street: "str. Test 1", city: "Test", phone: "0265 000 000", sortOrder: i },
    });
  }
  locIds = (await prisma.location.findMany({ where: { slug: { startsWith: tag } }, select: { id: true }, orderBy: { sortOrder: "asc" } })).map((l) => l.id);
  adminId = (await prisma.user.create({ data: { email: `${tag}-a@example.com`, passwordHash: "x", role: "ADMIN", firstName: "Ana", lastName: "Admin" } })).id;
  otherId = (await prisma.user.create({ data: { email: `${tag}-r@example.com`, passwordHash: "x", role: "RECEPTIE", firstName: "Rita", lastName: "Rec" } })).id;
});

describe("staff guards", () => {
  it("an admin cannot deactivate or demote themselves, nor the last admin", async () => {
    await expect(setUserActive(adminId, false, actorOf(adminId))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      updateUser({ id: adminId, email: `${tag}-a@example.com`, firstName: "Ana", lastName: "Admin", role: "RECEPTIE", locationIds: locIds }, actorOf(adminId)),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setUserActive(adminId, false, actorOf(otherId))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("deactivation and role changes revoke sessions", async () => {
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: otherId } })).sessionVersion;
    await updateUser({ id: otherId, email: `${tag}-r@example.com`, firstName: "Rita", lastName: "Rec", role: "MEDIC", locationIds: locIds }, actorOf(adminId));
    await setUserActive(otherId, false, actorOf(adminId));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    expect(after.active).toBe(false);
    expect(after.role).toBe("MEDIC");
    expect(after.sessionVersion).toBe(before + 2);
    const audits = await prisma.auditLog.findMany({ where: { entityId: otherId }, select: { action: true } });
    expect(audits.map((a) => a.action).sort()).toEqual(["user.deactivate", "user.update"]);
  });

  it("stores the ticked clinics and opens the single clinic by default", async () => {
    const id = (await prisma.user.create({ data: { email: `${tag}-c@example.com`, passwordHash: "x", role: "RECEPTIE", firstName: "Cora", lastName: "Clinică" } })).id;
    await updateUser({ id, email: `${tag}-c@example.com`, firstName: "Cora", lastName: "Clinică", role: "RECEPTIE", locationIds: [locIds[1]] }, actorOf(adminId));
    const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { homeLocationId: true, locations: { select: { locationId: true } } } });
    expect(u.locations.map((l) => l.locationId)).toEqual([locIds[1]]);
    expect(u.homeLocationId).toBe(locIds[1]);
    await updateUser({ id, email: `${tag}-c@example.com`, firstName: "Cora", lastName: "Clinică", role: "RECEPTIE", locationIds: locIds }, actorOf(adminId));
    const both = await prisma.user.findUniqueOrThrow({ where: { id }, select: { homeLocationId: true, locations: { select: { locationId: true } } } });
    expect(both.locations).toHaveLength(locIds.length);
    expect(both.homeLocationId).toBeNull();
  });
});
