"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { addToothCondition, resolveToothCondition } from "@/server/patients/odontogram";
import { addToothToPlan } from "@/server/patients/plans";
import { toothConditionResolveSchema, toothConditionSchema, toothPlanItemSchema } from "@/server/patients/schemas";

/** Odontogram (`medical.edit`; a plan line also needs `plans.manage`, checked by the service). */

export const addConditionAction = crmAction(
  { permission: "medical.edit", schema: toothConditionSchema, successMessage: (r: { tooth: number }) => `Constatarea a fost adăugată pe dintele ${r.tooth}.` },
  async ({ id, ...i }, { user }) => {
    await addToothCondition(user, id, i);
    revalidatePath(`/crm/pacienti/${id}/odontograma`);
    return { tooth: i.tooth };
  },
);

export const resolveConditionAction = crmAction(
  { permission: "medical.edit", schema: toothConditionResolveSchema, successMessage: "Constatarea a fost marcată ca rezolvată." },
  async ({ id, conditionId }, { user }) => {
    await resolveToothCondition(user, id, conditionId);
    revalidatePath(`/crm/pacienti/${id}/odontograma`);
    return null;
  },
);

export const addToothPlanItemAction = crmAction(
  { permission: "plans.manage", schema: toothPlanItemSchema, successMessage: "Lucrarea a fost adăugată în plan." },
  async ({ id, ...i }, { user }) => {
    const r = await addToothToPlan(user, id, i);
    revalidatePath(`/crm/pacienti/${id}`, "layout");
    return r;
  },
);
