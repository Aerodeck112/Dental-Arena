import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import {
  PERMISSIONS,
  can,
  canActOnDoctorAppointment,
  canManageTimeOff,
  permissionsOf,
  type Permission,
} from "../permissions";

const ROLES: Role[] = ["ADMIN", "MEDIC", "RECEPTIE"];
const admin = { role: "ADMIN" as const, doctorId: null };
const receptie = { role: "RECEPTIE" as const, doctorId: null };
const medic = { role: "MEDIC" as const, doctorId: "doctor-marcoci" };

/** The permission table exactly as written in docs/architecture.md §5.2. */
function permissionsFromSpec(): Record<string, Role[]> {
  const doc = readFileSync(path.join(process.cwd(), "docs/architecture.md"), "utf8");
  const start = doc.indexOf("export const PERMISSIONS = {");
  const end = doc.indexOf("} as const satisfies", start);
  expect(start).toBeGreaterThan(0);
  const table: Record<string, Role[]> = {};
  for (const m of doc.slice(start, end).matchAll(/"([\w.]+)":\s*\[([^\]]*)\]/g)) {
    table[m[1]] = [...m[2].matchAll(/"(\w+)"/g)].map((r) => r[1] as Role);
  }
  return table;
}

describe("PERMISSIONS", () => {
  it("matches docs/architecture.md §5.2 key for key", () => {
    const spec = permissionsFromSpec();
    expect(Object.keys(spec).length).toBeGreaterThan(40);
    expect(Object.fromEntries(Object.entries(PERMISSIONS).map(([k, v]) => [k, [...v]]))).toEqual(spec);
  });

  it("grants everything to ADMIN except the MEDIC-only own-appointment rule", () => {
    const missing = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => !can(admin, p));
    expect(missing).toEqual(["appointments.manageOwn"]);
  });

  it("only uses known roles", () => {
    for (const roles of Object.values(PERMISSIONS)) {
      expect(roles.length).toBeGreaterThan(0);
      for (const r of roles) expect(ROLES).toContain(r);
    }
  });
});

describe("can", () => {
  it("follows the §5.3 matrix for MEDIC", () => {
    for (const p of [
      "leads.view",
      "billing.view",
      "billing.create",
      "settings.manage",
      "audit.view",
      "gdpr.manage",
      "messages.view",
      "appointments.manage",
      "reports.view",
      "dashboard.revenue",
      "catalog.manage",
    ] as Permission[]) {
      expect(can(medic, p), p).toBe(false);
    }
    for (const p of [
      "appointments.view",
      "appointments.manageOwn",
      "medical.view",
      "medical.edit",
      "plans.manage",
      "patients.revealCnp",
      "reports.viewOwn",
      "recalls.view",
    ] as Permission[]) {
      expect(can(medic, p), p).toBe(true);
    }
  });

  it("follows the §5.3 matrix for RECEPTIE", () => {
    for (const p of ["leads.manage", "billing.create", "appointments.override", "messages.send", "reports.operational", "timeoff.manage"] as Permission[]) {
      expect(can(receptie, p), p).toBe(true);
    }
    for (const p of ["medical.view", "billing.cancel", "plans.manage", "reports.view", "gdpr.manage", "audit.view", "settings.manage", "documents.delete"] as Permission[]) {
      expect(can(receptie, p), p).toBe(false);
    }
  });

  it("accepts an array as „any of”", () => {
    expect(can(medic, ["appointments.manage", "appointments.manageOwn"])).toBe(true);
    expect(can(receptie, ["appointments.manage", "appointments.manageOwn"])).toBe(true);
    expect(can(medic, ["leads.view", "billing.view"])).toBe(false);
    expect(can(admin, [])).toBe(false);
  });

  it("denies a missing user", () => {
    expect(can(null, "dashboard.view")).toBe(false);
    expect(can(undefined, "dashboard.view")).toBe(false);
  });

  it("lists a role's permissions", () => {
    expect(permissionsOf("MEDIC")).toContain("medical.edit");
    expect(permissionsOf("MEDIC")).not.toContain("leads.view");
    expect(permissionsOf("ADMIN")).toHaveLength(Object.keys(PERMISSIONS).length - 1);
  });
});

describe("MEDIC scoping rules", () => {
  it("lets a MEDIC manage only their own time off", () => {
    expect(canManageTimeOff(medic, "doctor-marcoci")).toBe(true);
    expect(canManageTimeOff(medic, "doctor-masca")).toBe(false);
    expect(canManageTimeOff(medic, null)).toBe(false); // no location-wide closures
    expect(canManageTimeOff({ role: "MEDIC", doctorId: null }, null)).toBe(false);
    expect(canManageTimeOff(receptie, "doctor-masca")).toBe(true);
    expect(canManageTimeOff(admin, null)).toBe(true);
    expect(canManageTimeOff(null, "doctor-marcoci")).toBe(false);
  });

  it("lets a MEDIC act only on their own appointments", () => {
    expect(canActOnDoctorAppointment(medic, "doctor-marcoci")).toBe(true);
    expect(canActOnDoctorAppointment(medic, "doctor-masca")).toBe(false);
    expect(canActOnDoctorAppointment({ role: "MEDIC", doctorId: null }, "doctor-masca")).toBe(false);
    expect(canActOnDoctorAppointment(receptie, "doctor-masca")).toBe(true);
    expect(canActOnDoctorAppointment(admin, "doctor-masca")).toBe(true);
    expect(canActOnDoctorAppointment(null, "doctor-masca")).toBe(false);
  });
});
