"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { anonymizePatient } from "@/server/patients/gdpr";
import { anonymizeSchema } from "@/server/patients/schemas";

/** Erasure (`gdpr.manage`, ADMIN): requires typing the file number. The export is a route handler. */
export const anonymizePatientAction = crmAction(
  { permission: "gdpr.manage", schema: anonymizeSchema, successMessage: "Fișa a fost anonimizată." },
  async ({ id, confirmFileNumber }, { user }) => {
    const r = await anonymizePatient(user, id, confirmFileNumber);
    revalidatePath(`/crm/pacienti/${id}`, "layout");
    revalidatePath("/crm/pacienti");
    revalidatePath("/crm/programari");
    return r;
  },
);
