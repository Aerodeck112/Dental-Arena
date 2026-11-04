"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { createDataRequest, updateDataRequest } from "@/server/patients/gdpr";
import { dataRequestCreateSchema, dataRequestUpdateSchema } from "@/server/patients/schemas";

/** The register of GDPR requests (`gdpr.manage`). Every change is audited as `gdpr.request`. */

export const createDataRequestAction = crmAction(
  { permission: "gdpr.manage", schema: dataRequestCreateSchema, successMessage: "Cererea a fost înregistrată. Termenul de răspuns este de 30 de zile." },
  async (i, { user }) => {
    const r = await createDataRequest(user, i);
    revalidatePath("/crm/gdpr");
    if (i.patientId) revalidatePath(`/crm/pacienti/${i.patientId}/gdpr`);
    return r;
  },
);

export const updateDataRequestAction = crmAction(
  { permission: "gdpr.manage", schema: dataRequestUpdateSchema, successMessage: "Cererea a fost actualizată." },
  async (i, { user }) => {
    await updateDataRequest(user, i);
    revalidatePath("/crm/gdpr");
    revalidatePath("/crm/pacienti", "layout");
    return null;
  },
);
