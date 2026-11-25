"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { saveMedicalHistory } from "@/server/patients/medical";
import { medicalHistorySchema } from "@/server/patients/schemas";

/** Anamneză (`medical.edit`, ADMIN and MEDIC). Saving counts as a review and is audited. */
export const saveMedicalAction = crmAction(
  { permission: "medical.edit", schema: medicalHistorySchema, successMessage: "Anamneza a fost salvată și marcată ca revizuită." },
  async ({ id, ...i }, { user }) => {
    const r = await saveMedicalHistory(user, id, i);
    revalidatePath(`/crm/pacienti/${id}`, "layout");
    revalidatePath("/crm/programari");
    revalidatePath("/crm");
    return r;
  },
);
