"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { createPlan, deletePlanItem, savePlanItem, setPlanItemStatus, setPlanStatus, updatePlan } from "@/server/patients/plans";
import {
  planCreateSchema,
  planItemDeleteSchema,
  planItemSchema,
  planItemStatusSchema,
  planStatusSchema,
  planUpdateSchema,
} from "@/server/patients/schemas";

/** Treatment plans (`plans.manage`, ADMIN and MEDIC). Every change is audited as `plan.update`. */

function refresh(id: string) {
  revalidatePath(`/crm/pacienti/${id}`, "layout");
}

export const createPlanAction = crmAction({ permission: "plans.manage", schema: planCreateSchema }, async ({ id, ...i }, { user }) => {
  const plan = await createPlan(user, id, i);
  refresh(id);
  redirect(`/crm/pacienti/${id}/planuri/${plan.id}`);
});

export const updatePlanAction = crmAction(
  { permission: "plans.manage", schema: planUpdateSchema, successMessage: "Planul a fost salvat." },
  async ({ id, planId, ...i }, { user }) => {
    await updatePlan(user, id, planId, i);
    refresh(id);
    return null;
  },
);

export const setPlanStatusAction = crmAction(
  { permission: "plans.manage", schema: planStatusSchema, successMessage: "Statusul planului a fost schimbat." },
  async ({ id, planId, status }, { user }) => {
    await setPlanStatus(user, id, planId, status);
    refresh(id);
    return null;
  },
);

export const savePlanItemAction = crmAction(
  { permission: "plans.manage", schema: planItemSchema, successMessage: "Lucrarea a fost salvată." },
  async ({ id, planId, ...i }, { user }) => {
    const r = await savePlanItem(user, id, planId, i);
    refresh(id);
    return r;
  },
);

export const setPlanItemStatusAction = crmAction(
  { permission: "plans.manage", schema: planItemStatusSchema, successMessage: "Statusul lucrării a fost schimbat." },
  async ({ id, planId, itemId, status }, { user }) => {
    await setPlanItemStatus(user, id, planId, itemId, status);
    refresh(id);
    return null;
  },
);

export const deletePlanItemAction = crmAction(
  { permission: "plans.manage", schema: planItemDeleteSchema, successMessage: "Lucrarea a fost ștearsă din plan." },
  async ({ id, planId, itemId }, { user }) => {
    await deletePlanItem(user, id, planId, itemId);
    refresh(id);
    return null;
  },
);
