import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const { isolatedTestDb } = await import("./isolated-db");
  process.env.DATABASE_URL = isolatedTestDb("plans");
});

import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import {
  addToothToPlan,
  canTransitionPlan,
  computePlanTotals,
  createPlan,
  deletePlanItem,
  getPlan,
  implantProgress,
  lineTotal,
  savePlanItem,
  setPlanItemStatus,
  setPlanStatus,
} from "../plans";
import { makeUsers, rawPatient, runTag } from "./fixtures";

const tag = runTag();
let admin: CurrentUser;
let medic: CurrentUser;
let receptie: CurrentUser;
let implantId = "";
let noPriceId = "";

beforeAll(async () => {
  ({ admin, medic, receptie } = await makeUsers(tag));
  const cat = await prisma.serviceCategory.create({ data: { slug: `${tag}-cat`, name: "Implantologie test" } });
  implantId = (
    await prisma.service.create({ data: { categoryId: cat.id, code: `${tag}-IMP`, name: "Implant Neodent", priceMin: 220000, toothSpecific: true } })
  ).id;
  noPriceId = (await prisma.service.create({ data: { categoryId: cat.id, code: `${tag}-CONS`, name: "Consultație", priceMin: null } })).id;
});

describe("totals", () => {
  it("line total is quantity × price − discount", () => {
    expect(lineTotal(2, 15000, 5000)).toBe(25000);
    expect(lineTotal(1, 1000, 5000)).toBe(0);
  });
  it("ignores cancelled lines and caps the plan discount", () => {
    const t = computePlanTotals(
      [
        { quantity: 1, unitPrice: 220000, discount: 0, status: "EFECTUAT" },
        { quantity: 2, unitPrice: 55000, discount: 10000, status: "ACCEPTAT" },
        { quantity: 1, unitPrice: 99999, discount: 0, status: "ANULAT" },
      ],
      20000,
    );
    expect(t).toEqual({
      subtotal: 330000,
      lineDiscounts: 10000,
      planDiscount: 20000,
      total: 300000,
      done: 220000,
      active: 320000,
      itemCount: 2,
      doneCount: 1,
    });
    expect(computePlanTotals([{ quantity: 1, unitPrice: 100, discount: 0, status: "PROPUS" }], 500).total).toBe(0);
  });
});

describe("status flow", () => {
  it("follows CIORNA → PREZENTAT → ACCEPTAT → IN_CURS → FINALIZAT", () => {
    expect(canTransitionPlan("CIORNA", "PREZENTAT")).toBe(true);
    expect(canTransitionPlan("PREZENTAT", "ACCEPTAT")).toBe(true);
    expect(canTransitionPlan("ACCEPTAT", "IN_CURS")).toBe(true);
    expect(canTransitionPlan("IN_CURS", "FINALIZAT")).toBe(true);
    expect(canTransitionPlan("CIORNA", "FINALIZAT")).toBe(false);
    expect(canTransitionPlan("FINALIZAT", "CIORNA")).toBe(false);
  });
});

describe("implant progress", () => {
  const line = (code: string | null, description: string, status: "PROPUS" | "EFECTUAT" | "PROGRAMAT" | "ACCEPTAT", performedAt: string | null = null) => ({
    serviceCode: code,
    description,
    status,
    performedAt,
  });
  it("stands on healing three weeks after the implant", () => {
    const items = [
      line(null, "Radiografie panoramică", "EFECTUAT"),
      line("IMP-NEODENT", "Implant Neodent", "EFECTUAT", "2026-09-15T08:00:00.000Z"),
      line("IMP-BONT", "Bont protetic drept sau angulat", "PROGRAMAT"),
      line("PR-ZR-IMPLANT", "Coroană zirconiu monolitic pe implant", "ACCEPTAT"),
    ];
    const p = implantProgress(items, new Date("2026-10-06T10:00:00Z"));
    expect(p.current).toBe(2);
    expect(p.healingUntil?.slice(0, 10)).toBe("2026-12-15");
    expect(implantProgress(items, new Date("2027-01-01T10:00:00Z")).current).toBe(3);
  });
  it("is complete when the crown is fitted", () => {
    const items = [
      line("IMP-NEODENT", "Implant Neodent", "EFECTUAT", "2026-01-15T08:00:00.000Z"),
      line("IMP-BONT", "Bont", "EFECTUAT"),
      line("PR-ZR-IMPLANT", "Coroană pe implant", "EFECTUAT"),
    ];
    expect(implantProgress(items).current).toBe(5);
  });
});

describe("plan service", () => {
  it("copies the catalog price, enforces the flow and audits", async () => {
    const p = await rawPatient();
    const { id: planId } = await createPlan(medic, p.id, { title: "Plan implant 36" });
    await expect(setPlanStatus(medic, p.id, planId, "PREZENTAT")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(savePlanItem(medic, p.id, planId, { serviceId: implantId, phase: 1, quantity: 1, discount: 0 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const { id: itemId } = await savePlanItem(medic, p.id, planId, { serviceId: implantId, tooth: 36, phase: 1, quantity: 1, discount: 20000 });
    await expect(savePlanItem(medic, p.id, planId, { serviceId: noPriceId, phase: 1, quantity: 1, discount: 0 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await savePlanItem(medic, p.id, planId, { serviceId: noPriceId, phase: 1, quantity: 1, unitPrice: 15000, discount: 0 });
    let plan = await getPlan(p.id, planId);
    expect(plan?.items[0]).toMatchObject({ unitPrice: 220000, total: 200000, tooth: 36, description: "Implant Neodent", status: "PROPUS" });
    expect(plan?.totals.total).toBe(215000);
    expect(plan?.isImplant).toBe(true);

    await setPlanStatus(medic, p.id, planId, "PREZENTAT");
    await setPlanStatus(admin, p.id, planId, "ACCEPTAT");
    plan = await getPlan(p.id, planId);
    expect(plan?.items.every((i) => i.status === "ACCEPTAT")).toBe(true);
    expect(plan?.acceptedAt).not.toBeNull();
    await expect(deletePlanItem(medic, p.id, planId, itemId)).rejects.toMatchObject({ code: "CONFLICT" });

    await setPlanItemStatus(medic, p.id, planId, itemId, "EFECTUAT");
    plan = await getPlan(p.id, planId);
    expect(plan?.status).toBe("IN_CURS");
    await expect(setPlanStatus(medic, p.id, planId, "FINALIZAT")).rejects.toMatchObject({ code: "CONFLICT" });
    await setPlanItemStatus(medic, p.id, planId, plan!.items[1].id, "EFECTUAT");
    await setPlanStatus(medic, p.id, planId, "FINALIZAT");
    await expect(setPlanStatus(medic, p.id, planId, "CIORNA")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    const audits = await prisma.auditLog.count({ where: { patientId: p.id, action: "plan.update" } });
    expect(audits).toBeGreaterThanOrEqual(8);
  });

  it("reception reads but cannot change plans", async () => {
    const p = await rawPatient();
    await expect(createPlan(receptie, p.id, { title: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adds a tooth from the odontogram to a new draft plan", async () => {
    const p = await rawPatient();
    const r = await addToothToPlan(medic, p.id, { tooth: 46, serviceId: implantId, surfaces: null });
    const plan = await getPlan(p.id, r.planId);
    expect(plan).toMatchObject({ title: "Plan de tratament", status: "CIORNA" });
    expect(plan?.items[0]).toMatchObject({ tooth: 46, unitPrice: 220000 });
    const again = await addToothToPlan(medic, p.id, { tooth: 47, serviceId: implantId });
    expect(again.planId).toBe(r.planId);
  });
});
