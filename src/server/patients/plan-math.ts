import type { PlanItemStatus, PlanStatus } from "@/generated/prisma/enums";
import type { PlanTotalsDTO } from "./types";

/**
 * Pure treatment-plan rules (totals, status flows, implant progress). Client-safe and unit-tested;
 * `plans.ts` applies them to the database.
 */

/** Line total in bani: quantity × unit price − discount, never negative. */
export function lineTotal(quantity: number, unitPrice: number, discount: number): number {
  return Math.max(0, quantity * unitPrice - discount);
}

export function computePlanTotals(
  items: { quantity: number; unitPrice: number; discount: number; status: PlanItemStatus }[],
  planDiscount: number,
): PlanTotalsDTO {
  let subtotal = 0;
  let lineDiscounts = 0;
  let active = 0;
  let done = 0;
  let itemCount = 0;
  let doneCount = 0;
  for (const it of items) {
    if (it.status === "ANULAT") continue;
    const gross = it.quantity * it.unitPrice;
    const disc = Math.min(it.discount, gross);
    const t = gross - disc;
    subtotal += gross;
    lineDiscounts += disc;
    active += t;
    itemCount += 1;
    if (it.status === "EFECTUAT") {
      done += t;
      doneCount += 1;
    }
  }
  const pd = Math.max(0, Math.min(planDiscount, active));
  return { subtotal, lineDiscounts, planDiscount: pd, total: active - pd, done, active, itemCount, doneCount };
}

/** CIORNA → PREZENTAT → ACCEPTAT → IN_CURS → FINALIZAT, with RESPINS and ANULAT on the side. */
export const PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  CIORNA: ["PREZENTAT", "ANULAT"],
  PREZENTAT: ["ACCEPTAT", "RESPINS", "CIORNA", "ANULAT"],
  ACCEPTAT: ["IN_CURS", "ANULAT"],
  IN_CURS: ["FINALIZAT", "ANULAT"],
  FINALIZAT: [],
  RESPINS: ["CIORNA"],
  ANULAT: [],
};

export function canTransitionPlan(from: PlanStatus, to: PlanStatus): boolean {
  return PLAN_TRANSITIONS[from].includes(to);
}

/** Verb for the button that moves a plan to `to`. */
export const PLAN_STATUS_ACTION: Record<PlanStatus, string> = {
  CIORNA: "Readuceți la ciornă",
  PREZENTAT: "Marcați ca prezentat",
  ACCEPTAT: "Marcați ca acceptat",
  IN_CURS: "Începeți tratamentul",
  FINALIZAT: "Finalizați planul",
  RESPINS: "Marcați ca respins",
  ANULAT: "Anulați planul",
};

/** Prices, quantities and lines can change only before the patient accepts the plan. */
export function planPricesEditable(s: PlanStatus): boolean {
  return s === "CIORNA" || s === "PREZENTAT";
}
/** New lines may be added until the plan is closed. */
export function planOpen(s: PlanStatus): boolean {
  return s === "CIORNA" || s === "PREZENTAT" || s === "ACCEPTAT" || s === "IN_CURS";
}

export const ITEM_TRANSITIONS: Record<PlanItemStatus, PlanItemStatus[]> = {
  PROPUS: ["ACCEPTAT", "PROGRAMAT", "EFECTUAT", "ANULAT"],
  ACCEPTAT: ["PROGRAMAT", "EFECTUAT", "ANULAT", "PROPUS"],
  PROGRAMAT: ["EFECTUAT", "ACCEPTAT", "ANULAT"],
  EFECTUAT: [],
  ANULAT: ["PROPUS"],
};

export function canTransitionItem(from: PlanItemStatus, to: PlanItemStatus): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}

// ───────────────────────────── Implant progress (Filetul) ─────────────────────────────

export const IMPLANT_STEPS = ["Radiografii", "Implant", "Vindecare 3–6 luni", "Bont", "Coroană"] as const;

type ProgressItem = { serviceCode: string | null; description: string; status: PlanItemStatus; performedAt: string | null };

const isImplantItem = (i: ProgressItem) =>
  (i.serviceCode?.startsWith("IMP-") && !["IMP-BONT", "IMP-CONSULT"].includes(i.serviceCode) && /implant/i.test(i.description)) ||
  /^implant\b/i.test(i.description);
const isAbutment = (i: ProgressItem) => i.serviceCode === "IMP-BONT" || /\bbont\b/i.test(i.description);
const isCrown = (i: ProgressItem) =>
  (i.serviceCode?.startsWith("PR-") && /implant/i.test(i.description)) || /coroan/i.test(i.description);
const isXray = (i: ProgressItem) => /radiograf|cbct/i.test(i.description);

export function isImplantPlan(items: ProgressItem[]): boolean {
  return items.some((i) => i.status !== "ANULAT" && isImplantItem(i));
}

/** Healing period before the abutment: three months from the implant (the short end of 3–6). */
export const HEALING_MONTHS = 3;

function addMonths(iso: string, n: number): Date {
  const d = new Date(iso);
  const out = new Date(d);
  out.setUTCMonth(d.getUTCMonth() + n);
  return out;
}

/**
 * Pure: where an implant plan stands on the five steps. `current` is the index of the first step
 * not done (5 = all done). `healingUntil` is set once the implant is placed.
 */
export function implantProgress(items: ProgressItem[], now: Date = new Date()): { current: number; healingUntil: string | null } {
  const live = items.filter((i) => i.status !== "ANULAT");
  const doneAll = (pred: (i: ProgressItem) => boolean) => {
    const list = live.filter(pred);
    return list.length > 0 && list.every((i) => i.status === "EFECTUAT");
  };
  const implantDone = doneAll(isImplantItem);
  const abutmentDone = doneAll(isAbutment);
  const crownDone = doneAll(isCrown);
  const xrays = live.filter(isXray);
  const xrayDone = xrays.length > 0 ? xrays.every((i) => i.status === "EFECTUAT") : implantDone;
  const placedAt = live
    .filter((i) => isImplantItem(i) && i.status === "EFECTUAT" && i.performedAt)
    .map((i) => i.performedAt as string)
    .sort()
    .pop();
  const healingUntil = placedAt ? addMonths(placedAt, HEALING_MONTHS).toISOString() : null;
  const healed = abutmentDone || crownDone || (healingUntil !== null && new Date(healingUntil) <= now);
  const steps = [xrayDone, implantDone, implantDone && healed, abutmentDone, crownDone];
  const current = steps.findIndex((s) => !s);
  return { current: current === -1 ? steps.length : current, healingUntil };
}
