"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { cnpRevealSchema, comfortSchema, patientUpdateSchema, tagsSchema } from "@/server/patients/schemas";
import { revealCnp, updatePatient, updatePatientComfort } from "@/server/patients/service";
import { setPatientTags } from "@/server/patients/tags";

/** „Date personale”: demographics, contact, CNP, tags and the comfort answer (`patients.edit`). */

function refresh(id: string) {
  revalidatePath(`/crm/pacienti/${id}`, "layout");
  revalidatePath("/crm/pacienti");
}

export const updatePatientAction = crmAction(
  { permission: "patients.edit", schema: patientUpdateSchema, successMessage: "Datele pacientului au fost salvate." },
  async ({ id, ...i }, { user }) => {
    const r = await updatePatient(user, id, i);
    refresh(id);
    return r;
  },
);

/** Returns the clear CNP once; the client shows it for 30 seconds. Audited as `patient.cnp.reveal`. */
export const revealCnpAction = crmAction({ permission: "patients.revealCnp", schema: cnpRevealSchema }, async ({ id }, { user }) => ({
  cnp: await revealCnp(user, id),
}));

export const setTagsAction = crmAction(
  { permission: "patients.edit", schema: tagsSchema, successMessage: "Etichetele au fost salvate." },
  async ({ id, tagIds, newTag }, { user }) => {
    await setPatientTags(user, id, { tagIds, newTag });
    refresh(id);
    return null;
  },
);

export const saveComfortAction = crmAction(
  { permission: "patients.edit", schema: comfortSchema, successMessage: "Preferințele de confort au fost salvate." },
  async ({ id, comfortDefault, prefersSedation }, { user }) => {
    await updatePatientComfort(user, id, { comfortDefault, prefersSedation });
    refresh(id);
    revalidatePath("/crm/programari");
    return null;
  },
);
