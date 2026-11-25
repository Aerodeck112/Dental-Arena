"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crmAction } from "@/lib/actions";
import { zId } from "@/lib/validation/common";
import { createUserSchema, doctorProfileSchema, resetPasswordSchema, setActiveSchema, updateUserSchema } from "@/server/staff/schemas";
import {
  createUser,
  resetUserPassword,
  revokeUserSessions,
  saveDoctorProfile,
  setUserActive,
  updateUser,
} from "@/server/staff/service";

/**
 * Team (docs/architecture.md §4.2 `/crm/echipa`): ADMIN only (`staff.manage`). Role changes,
 * deactivation and password resets log the user out everywhere (`sessionVersion++`). Doctor
 * profiles feed the public team pages, so their saves revalidate the site.
 */

function revalidateTeam() {
  revalidatePath("/crm/echipa", "layout");
}

export const createUserAction = crmAction({ permission: "staff.manage", schema: createUserSchema }, async (i, { user }) => {
  const r = await createUser(i, user);
  revalidateTeam();
  if (i.linkDoctorId) revalidatePath("/", "layout");
  redirect(`/crm/echipa/${r.id}?creat=1`);
});

export const updateUserAction = crmAction(
  { permission: "staff.manage", schema: updateUserSchema, successMessage: "Datele contului au fost salvate." },
  async (i, { user }) => {
    const r = await updateUser(i, user);
    revalidateTeam();
    return r;
  },
);

export const resetPasswordAction = crmAction(
  {
    permission: "staff.manage",
    schema: resetPasswordSchema,
    successMessage: "Parola a fost schimbată. Utilizatorul a fost deconectat și o va schimba la prima intrare.",
  },
  async ({ id, password }, { user }) => {
    await resetUserPassword(id, password, user);
    revalidateTeam();
    return null;
  },
);

export const setUserActiveAction = crmAction(
  { permission: "staff.manage", schema: setActiveSchema, successMessage: (d: { active: boolean }) => (d.active ? "Contul a fost reactivat." : "Contul a fost dezactivat și deconectat.") },
  async ({ id, active }, { user }) => {
    await setUserActive(id, active, user);
    revalidateTeam();
    return { active };
  },
);

export const revokeSessionsAction = crmAction(
  { permission: "staff.manage", schema: z.object({ id: zId }), successMessage: "Toate sesiunile utilizatorului au fost închise." },
  async ({ id }, { user }) => {
    await revokeUserSessions(id, user);
    return null;
  },
);

export const saveDoctorProfileAction = crmAction(
  { permission: "staff.manage", schema: doctorProfileSchema, successMessage: "Profilul de medic a fost salvat. Pagina de echipă de pe site se actualizează." },
  async (i, { user }) => {
    const r = await saveDoctorProfile(i, user);
    revalidateTeam();
    revalidatePath("/", "layout");
    if (!i.doctorId && !i.userId) redirect(`/crm/echipa/${r.id}?creat=1`);
    return r;
  },
);
