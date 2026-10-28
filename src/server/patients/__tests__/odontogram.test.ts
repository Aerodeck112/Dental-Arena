import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const { isolatedTestDb } = await import("./isolated-db");
  process.env.DATABASE_URL = isolatedTestDb("odontogram");
});

import type { CurrentUser } from "@/lib/auth/dal";
import { addToothCondition, groupByTooth, listToothConditions, resolveToothCondition, supersededIds } from "../odontogram";
import { makeUsers, rawPatient, runTag } from "./fixtures";

const tag = runTag();
let admin: CurrentUser;
let medic: CurrentUser;
let receptie: CurrentUser;

beforeAll(async () => {
  ({ admin, medic, receptie } = await makeUsers(tag));
});

describe("supersededIds", () => {
  const active = [
    { id: "a", tooth: 36, condition: "CARIE" as const, surfaces: "MO" },
    { id: "b", tooth: 36, condition: "OBTURATIE" as const, surfaces: "D" },
    { id: "c", tooth: 37, condition: "CARIE" as const, surfaces: "O" },
    { id: "d", tooth: 36, condition: "EXTRAS" as const, surfaces: null },
  ];
  it("replaces every active row of the tooth on request", () => {
    expect(supersededIds(active, { tooth: 36, condition: "OBTURATIE", surfaces: "MO" }, true)).toEqual(["a", "b", "d"]);
  });
  it("otherwise replaces only the same finding on overlapping surfaces", () => {
    expect(supersededIds(active, { tooth: 36, condition: "CARIE", surfaces: "O" }, false)).toEqual(["a"]);
    expect(supersededIds(active, { tooth: 36, condition: "CARIE", surfaces: "V" }, false)).toEqual([]);
  });
  it("an implant replaces an extraction", () => {
    expect(supersededIds(active, { tooth: 36, condition: "IMPLANT", surfaces: null }, false)).toEqual(["d"]);
  });
  it("groups only active rows", () => {
    const g = groupByTooth([
      { tooth: 11, resolvedAt: null },
      { tooth: 11, resolvedAt: "2026-01-01" },
      { tooth: 21, resolvedAt: null },
    ]);
    expect(g.get(11)).toHaveLength(1);
    expect([...g.keys()]).toEqual([11, 21]);
  });
});

describe("odontogram service", () => {
  it("records, replaces and resolves findings, with canonical surfaces", async () => {
    const p = await rawPatient();
    await addToothCondition(medic, p.id, { tooth: 26, condition: "CARIE", surfaces: "lom" });
    const r = await addToothCondition(admin, p.id, { tooth: 26, condition: "OBTURATIE", surfaces: "MO", replaceExisting: true });
    expect(r.resolved).toBe(1);
    const rows = await listToothConditions(medic, p.id);
    const active = rows.filter((x) => !x.resolvedAt);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ tooth: 26, condition: "OBTURATIE", surfaces: "MO" });
    expect(rows.find((x) => x.condition === "CARIE")?.surfaces).toBe("MOP");
    await resolveToothCondition(medic, p.id, active[0].id);
    expect((await listToothConditions(admin, p.id)).every((x) => x.resolvedAt)).toBe(true);
  });
  it("rejects invalid teeth and reception", async () => {
    const p = await rawPatient();
    await expect(addToothCondition(medic, p.id, { tooth: 19, condition: "CARIE" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addToothCondition(receptie, p.id, { tooth: 11, condition: "CARIE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listToothConditions(receptie, p.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
