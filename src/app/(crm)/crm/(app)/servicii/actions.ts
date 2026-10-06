"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crmAction } from "@/lib/actions";
import { zId } from "@/lib/validation/common";
import { categorySchema, serviceSchema } from "@/server/catalog/schemas";
import { deleteCategory, deleteService, saveCategory, saveService } from "@/server/catalog/service";

/**
 * Catalog (docs/architecture.md §4.2 `/crm/servicii`): ADMIN only (`catalog.manage`). The public
 * site renders prices, booking reasons and durations from these rows, so every save revalidates it.
 */

function revalidateCatalog() {
  revalidatePath("/crm/servicii", "layout");
  revalidatePath("/", "layout");
}

export const saveCategoryAction = crmAction(
  { permission: "catalog.manage", schema: categorySchema, successMessage: "Categoria a fost salvată." },
  async (i, { user }) => {
    const r = await saveCategory(i, user);
    revalidateCatalog();
    return r;
  },
);

export const deleteCategoryAction = crmAction(
  { permission: "catalog.manage", schema: z.object({ id: zId }), successMessage: "Categoria a fost ștearsă." },
  async ({ id }, { user }) => {
    const r = await deleteCategory(id, user);
    revalidateCatalog();
    return r;
  },
);

export const saveServiceAction = crmAction(
  { permission: "catalog.manage", schema: serviceSchema, successMessage: "Serviciul a fost salvat. Prețul apare pe site în câteva momente." },
  async (i, { user }) => {
    const r = await saveService(i, user);
    revalidateCatalog();
    if (!i.id) redirect(`/crm/servicii/${r.id}?salvat=1`);
    return r;
  },
);

export const deleteServiceAction = crmAction(
  { permission: "catalog.manage", schema: z.object({ id: zId }) },
  async ({ id }, { user }) => {
    const r = await deleteService(id, user);
    revalidateCatalog();
    redirect(`/crm/servicii?${r.deleted ? "sters" : "dezactivat"}=1`);
  },
);
