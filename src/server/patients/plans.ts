import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PlanItemStatus, PlanStatus } from "@/generated/prisma/enums";
import { canonicalSurfaces } from "@/components/crm/odontogram/fdi";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { PLAN_ITEM_STATUS_LABEL, PLAN_STATUS_LABEL } from "@/lib/labels";
import {
  canTransitionItem,
  canTransitionPlan,
  computePlanTotals,
  isImplantPlan,
  lineTotal,
  planOpen,
  planPricesEditable,
} from "./plan-math";
import { assertPatientEditable } from "./service";
import type { PlanDetailDTO, PlanItemDTO, PlanSummaryDTO } from "./types";

/**
 * Treatment plans (docs/architecture.md WP7 „Plans”): phases and lines (tooth, service, quantity,
 * unit price copied from the catalog, discount, status). Every change is audited as `plan.update`.
 * RECEPTIE reads plans (to bill); only ADMIN and MEDIC change them.
 */

export * from "./plan-math";

function assertManage(user: CurrentUser) {
  if (!can(user, "plans.manage")) throw new DomainError("FORBIDDEN", "Doar medicii și administratorii pot modifica planurile.");
}

const ITEM_SELECT = {
  id: true,
  serviceId: true,
  tooth: true,
  surfaces: true,
  description: true,
  phase: true,
  quantity: true,
  unitPrice: true,
  discount: true,
  status: true,
  performedAt: true,
  appointmentId: true,
  sortOrder: true,
  service: { select: { code: true } },
} as const;

type ItemRow = {
  id: string;
  serviceId: string | null;
  tooth: number | null;
  surfaces: string | null;
  description: string;
  phase: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  status: PlanItemStatus;
  performedAt: Date | null;
  appointmentId: string | null;
  sortOrder: number;
  service: { code: string | null } | null;
};

function toItem(r: ItemRow): PlanItemDTO {
  return {
    id: r.id,
    serviceId: r.serviceId,
    serviceCode: r.service?.code ?? null,
    tooth: r.tooth,
    surfaces: r.surfaces,
    description: r.description,
    phase: r.phase,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    discount: r.discount,
    total: lineTotal(r.quantity, r.unitPrice, r.discount),
    status: r.status,
    performedAt: r.performedAt?.toISOString() ?? null,
    appointmentId: r.appointmentId,
    sortOrder: r.sortOrder,
  };
}

const PLAN_SELECT = {
  id: true,
  patientId: true,
  title: true,
  status: true,
  notes: true,
  discount: true,
  createdAt: true,
  updatedAt: true,
  presentedAt: true,
  acceptedAt: true,
  doctor: { select: { id: true, publicName: true } },
  items: { select: ITEM_SELECT, orderBy: [{ phase: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.TreatmentPlanSelect;

type PlanRow = {
  id: string;
  title: string;
  status: PlanStatus;
  notes: string | null;
  discount: number;
  createdAt: Date;
  updatedAt: Date;
  presentedAt: Date | null;
  acceptedAt: Date | null;
  doctor: { id: string; publicName: string } | null;
  items: ItemRow[];
};

function toDetail(p: PlanRow): PlanDetailDTO {
  const items = p.items.map(toItem);
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    doctor: p.doctor ? { id: p.doctor.id, name: p.doctor.publicName } : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    presentedAt: p.presentedAt?.toISOString() ?? null,
    acceptedAt: p.acceptedAt?.toISOString() ?? null,
    totals: computePlanTotals(items, p.discount),
    isImplant: isImplantPlan(items),
    notes: p.notes,
    discount: p.discount,
    items,
  };
}

export async function listPlans(patientId: string): Promise<PlanSummaryDTO[]> {
  const rows = await prisma.treatmentPlan.findMany({ where: { patientId }, orderBy: { createdAt: "desc" }, select: PLAN_SELECT });
  return rows.map((r) => {
    const d = toDetail(r);
    const summary: PlanSummaryDTO = {
      id: d.id,
      title: d.title,
      status: d.status,
      doctor: d.doctor,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      presentedAt: d.presentedAt,
      acceptedAt: d.acceptedAt,
      totals: d.totals,
      isImplant: d.isImplant,
    };
    return summary;
  });
}

export async function getPlan(patientId: string, planId: string): Promise<PlanDetailDTO | null> {
  const p = await prisma.treatmentPlan.findFirst({ where: { id: planId, patientId }, select: PLAN_SELECT });
  return p ? toDetail(p) : null;
}

async function loadPlanForWrite(tx: Tx, patientId: string, planId: string) {
  await assertPatientEditable(tx, patientId);
  const p = await tx.treatmentPlan.findFirst({ where: { id: planId, patientId }, select: { id: true, status: true, doctorId: true } });
  if (!p) throw new DomainError("NOT_FOUND", "Planul nu a fost găsit.");
  return p;
}

async function assertDoctor(tx: Tx, doctorId: string | null | undefined) {
  if (!doctorId) return;
  const d = await tx.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
  if (!d) throw new DomainError("VALIDATION", "Alegeți un medic din listă.", { fieldErrors: { doctorId: ["Alegeți un medic din listă."] } });
}

async function auditPlan(tx: Tx, actor: CurrentUser, patientId: string, planId: string, fields: string[], extra: Record<string, unknown> = {}) {
  await audit({ action: "plan.update", entityType: "TreatmentPlan", entityId: planId, patientId, metadata: { fields, ...extra } }, { actor, db: tx });
}

export async function createPlan(
  actor: CurrentUser,
  patientId: string,
  i: { title: string; doctorId?: string | null; notes?: string | null },
): Promise<{ id: string }> {
  assertManage(actor);
  return prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    await assertDoctor(tx, i.doctorId);
    const plan = await tx.treatmentPlan.create({
      data: {
        patientId,
        title: i.title.trim(),
        doctorId: i.doctorId ?? actor.doctorId ?? null,
        notes: i.notes ?? null,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await auditPlan(tx, actor, patientId, plan.id, ["created"]);
    return plan;
  });
}

export async function updatePlan(
  actor: CurrentUser,
  patientId: string,
  planId: string,
  i: { title: string; doctorId?: string | null; notes?: string | null; discount: number },
): Promise<void> {
  assertManage(actor);
  await prisma.$transaction(async (tx) => {
    const p = await loadPlanForWrite(tx, patientId, planId);
    if (!planOpen(p.status)) throw new DomainError("CONFLICT", "Planul este închis și nu mai poate fi modificat.");
    await assertDoctor(tx, i.doctorId);
    const before = await tx.treatmentPlan.findUniqueOrThrow({ where: { id: planId }, select: { discount: true } });
    if (i.discount !== before.discount && !planPricesEditable(p.status)) {
      throw new DomainError("CONFLICT", "Reducerea nu se mai poate schimba după ce pacientul a acceptat planul.", {
        fieldErrors: { discount: ["Reducerea nu se mai poate schimba după acceptare."] },
      });
    }
    await tx.treatmentPlan.update({
      where: { id: planId },
      data: { title: i.title.trim(), doctorId: i.doctorId ?? null, notes: i.notes ?? null, discount: i.discount },
    });
    await auditPlan(tx, actor, patientId, planId, ["title", "doctorId", "notes", "discount"]);
  });
}

export async function setPlanStatus(actor: CurrentUser, patientId: string, planId: string, to: PlanStatus, now: Date = new Date()): Promise<void> {
  assertManage(actor);
  await prisma.$transaction(async (tx) => {
    const p = await loadPlanForWrite(tx, patientId, planId);
    if (!canTransitionPlan(p.status, to)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Planul nu poate trece din „${PLAN_STATUS_LABEL[p.status]}” în „${PLAN_STATUS_LABEL[to]}”.`,
      );
    }
    const items = await tx.treatmentPlanItem.findMany({ where: { planId }, select: { id: true, status: true } });
    if (to === "PREZENTAT" && !items.some((it) => it.status !== "ANULAT")) {
      throw new DomainError("CONFLICT", "Adăugați cel puțin o lucrare înainte să prezentați planul.");
    }
    if (to === "FINALIZAT" && items.some((it) => it.status !== "EFECTUAT" && it.status !== "ANULAT")) {
      throw new DomainError("CONFLICT", "Planul are lucrări neefectuate. Marcați-le efectuate sau anulați-le, apoi finalizați planul.");
    }
    const data: { status: PlanStatus; presentedAt?: Date; acceptedAt?: Date } = { status: to };
    if (to === "PREZENTAT") data.presentedAt = now;
    if (to === "ACCEPTAT") data.acceptedAt = now;
    await tx.treatmentPlan.update({ where: { id: planId }, data });
    if (to === "ACCEPTAT") {
      await tx.treatmentPlanItem.updateMany({ where: { planId, status: "PROPUS" }, data: { status: "ACCEPTAT" } });
    }
    if (to === "ANULAT" || to === "RESPINS") {
      await tx.treatmentPlanItem.updateMany({ where: { planId, status: { in: ["PROPUS", "ACCEPTAT"] } }, data: { status: "ANULAT" } });
    }
    await auditPlan(tx, actor, patientId, planId, ["status"], { from: p.status, to });
  });
}

/** Catalog price of a service: its minimum („de la”) price in bani, or null when set at the consultation. */
async function catalogService(tx: Tx, serviceId: string) {
  const s = await tx.service.findUnique({ where: { id: serviceId }, select: { id: true, name: true, priceMin: true, active: true, toothSpecific: true } });
  if (!s) throw new DomainError("VALIDATION", "Alegeți un serviciu din listă.", { fieldErrors: { serviceId: ["Alegeți un serviciu din listă."] } });
  return s;
}

export type PlanItemInput = {
  serviceId?: string | null;
  description?: string | null;
  tooth?: number | null;
  surfaces?: string | null;
  phase: number;
  quantity: number;
  unitPrice?: number | null;
  discount: number;
};

/** Adds a line, or edits it when `itemId` is set. The unit price is copied from the catalog when left empty. */
export async function savePlanItem(
  actor: CurrentUser,
  patientId: string,
  planId: string,
  i: PlanItemInput & { itemId?: string | null },
): Promise<{ id: string }> {
  assertManage(actor);
  return prisma.$transaction(async (tx) => {
    const p = await loadPlanForWrite(tx, patientId, planId);
    const existing = i.itemId
      ? await tx.treatmentPlanItem.findFirst({ where: { id: i.itemId, planId }, select: { id: true, status: true, unitPrice: true, quantity: true, discount: true } })
      : null;
    if (i.itemId && !existing) throw new DomainError("NOT_FOUND", "Lucrarea nu a fost găsită.");
    if (!planOpen(p.status)) throw new DomainError("CONFLICT", "Planul este închis și nu mai poate fi modificat.");

    const service = i.serviceId ? await catalogService(tx, i.serviceId) : null;
    const description = (i.description?.trim() || service?.name || "").slice(0, 200);
    if (!description) {
      throw new DomainError("VALIDATION", "Alegeți un serviciu sau descrieți lucrarea.", {
        fieldErrors: { serviceId: ["Alegeți un serviciu sau descrieți lucrarea."] },
      });
    }
    if (service?.toothSpecific && !i.tooth) {
      throw new DomainError("VALIDATION", "Această lucrare se face pe un dinte. Alegeți dintele.", {
        fieldErrors: { tooth: ["Alegeți dintele (numerotare FDI, de exemplu 36)."] },
      });
    }
    const unitPrice = i.unitPrice ?? existing?.unitPrice ?? service?.priceMin ?? null;
    if (unitPrice === null) {
      throw new DomainError("VALIDATION", "Serviciul nu are preț în listă. Introduceți prețul.", {
        fieldErrors: { unitPrice: ["Serviciul nu are preț în listă. Introduceți prețul."] },
      });
    }
    if (i.discount > i.quantity * unitPrice) {
      throw new DomainError("VALIDATION", "Reducerea nu poate depăși valoarea lucrării.", {
        fieldErrors: { discount: ["Reducerea nu poate depăși valoarea lucrării."] },
      });
    }
    const priceChanged = !existing || existing.unitPrice !== unitPrice || existing.quantity !== i.quantity || existing.discount !== i.discount;
    if (priceChanged && !planPricesEditable(p.status) && existing) {
      throw new DomainError("CONFLICT", "Prețurile nu se mai schimbă după ce pacientul a acceptat planul. Adăugați o lucrare nouă.");
    }
    const data = {
      serviceId: service?.id ?? null,
      description,
      tooth: i.tooth ?? null,
      surfaces: i.tooth ? canonicalSurfaces(i.tooth, i.surfaces) : null,
      phase: i.phase,
      quantity: i.quantity,
      unitPrice,
      discount: i.discount,
    };
    let id: string;
    if (existing) {
      await tx.treatmentPlanItem.update({ where: { id: existing.id }, data });
      id = existing.id;
    } else {
      const last = await tx.treatmentPlanItem.aggregate({ where: { planId }, _max: { sortOrder: true } });
      const created = await tx.treatmentPlanItem.create({
        data: { planId, ...data, status: "PROPUS", sortOrder: (last._max.sortOrder ?? 0) + 1 },
        select: { id: true },
      });
      id = created.id;
    }
    await tx.treatmentPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    await auditPlan(tx, actor, patientId, planId, [existing ? "item.update" : "item.create"]);
    return { id };
  });
}

export async function setPlanItemStatus(
  actor: CurrentUser,
  patientId: string,
  planId: string,
  itemId: string,
  to: PlanItemStatus,
  now: Date = new Date(),
): Promise<void> {
  assertManage(actor);
  await prisma.$transaction(async (tx) => {
    const p = await loadPlanForWrite(tx, patientId, planId);
    if (!planOpen(p.status)) throw new DomainError("CONFLICT", "Planul este închis și nu mai poate fi modificat.");
    const it = await tx.treatmentPlanItem.findFirst({ where: { id: itemId, planId }, select: { id: true, status: true } });
    if (!it) throw new DomainError("NOT_FOUND", "Lucrarea nu a fost găsită.");
    if (!canTransitionItem(it.status, to)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Lucrarea nu poate trece din „${PLAN_ITEM_STATUS_LABEL[it.status]}” în „${PLAN_ITEM_STATUS_LABEL[to]}”.`,
      );
    }
    await tx.treatmentPlanItem.update({
      where: { id: it.id },
      data: {
        status: to,
        ...(to === "EFECTUAT" ? { performedAt: now, performedByDoctorId: actor.doctorId ?? p.doctorId ?? null } : {}),
      },
    });
    // Work started on an accepted plan: the plan is in progress.
    if (p.status === "ACCEPTAT" && (to === "PROGRAMAT" || to === "EFECTUAT")) {
      await tx.treatmentPlan.update({ where: { id: planId }, data: { status: "IN_CURS" } });
    } else {
      await tx.treatmentPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    }
    await auditPlan(tx, actor, patientId, planId, ["item.status"], { from: it.status, to });
  });
}

/** Deletes a line before acceptance; afterwards a line is cancelled (ANULAT) instead. */
export async function deletePlanItem(actor: CurrentUser, patientId: string, planId: string, itemId: string): Promise<void> {
  assertManage(actor);
  await prisma.$transaction(async (tx) => {
    const p = await loadPlanForWrite(tx, patientId, planId);
    if (!planPricesEditable(p.status)) {
      throw new DomainError("CONFLICT", "După acceptare lucrările nu se șterg. Anulați lucrarea.");
    }
    const it = await tx.treatmentPlanItem.findFirst({ where: { id: itemId, planId }, select: { id: true, _count: { select: { invoiceItems: true } } } });
    if (!it) throw new DomainError("NOT_FOUND", "Lucrarea nu a fost găsită.");
    if (it._count.invoiceItems > 0) throw new DomainError("CONFLICT", "Lucrarea a fost facturată și nu se poate șterge.");
    await tx.treatmentPlanItem.delete({ where: { id: it.id } });
    await auditPlan(tx, actor, patientId, planId, ["item.delete"]);
  });
}

/**
 * From the odontogram: adds a line for a tooth to an open plan, or to a new draft
 * „Plan de tratament” when none is chosen. The price comes from the catalog.
 */
export async function addToothToPlan(
  actor: CurrentUser,
  patientId: string,
  i: { tooth: number; serviceId: string; surfaces?: string | null; planId?: string | null },
): Promise<{ planId: string; itemId: string }> {
  assertManage(actor);
  let planId = i.planId ?? null;
  if (!planId) {
    const open = await prisma.treatmentPlan.findFirst({
      where: { patientId, status: { in: ["CIORNA", "PREZENTAT"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    planId = open?.id ?? (await createPlan(actor, patientId, { title: "Plan de tratament" })).id;
  }
  const { id } = await savePlanItem(actor, patientId, planId, {
    serviceId: i.serviceId,
    tooth: i.tooth,
    surfaces: i.surfaces,
    phase: 1,
    quantity: 1,
    discount: 0,
  });
  return { planId, itemId: id };
}

/** Plans a new line can be added to (odontogram dialog). */
export async function listOpenPlans(patientId: string): Promise<{ id: string; title: string; status: PlanStatus }[]> {
  return prisma.treatmentPlan.findMany({
    where: { patientId, status: { in: ["CIORNA", "PREZENTAT", "ACCEPTAT", "IN_CURS"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, status: true },
  });
}

/** Active catalog services for the plan editor and the odontogram: code, name and price in bani. */
export async function listPlanServices(): Promise<
  { id: string; code: string | null; name: string; category: string; price: number | null; toothSpecific: boolean }[]
> {
  const rows = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, priceMin: true, toothSpecific: true, category: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, category: r.category.name, price: r.priceMin, toothSpecific: r.toothSpecific }));
}
