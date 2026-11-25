"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crmAction } from "@/lib/actions";
import { zId } from "@/lib/validation/common";
import { createTimeOff, deleteTimeOff, timeOffSchema } from "@/server/scheduling/schedules";

/**
 * Time off and closures (docs/architecture.md §4.2 `/crm/absente`). ADMIN and RECEPTIE manage
 * anyone's time off and clinic closures; a MEDIC only their own (enforced in the service by
 * `canManageTimeOff`). Free slots drop the interval at once.
 */

function revalidateTimeOff() {
  revalidatePath("/crm/absente");
  revalidatePath("/crm/programari");
  revalidatePath("/crm/echipa", "layout");
}

export const createTimeOffAction = crmAction(
  {
    permission: "schedules.view",
    schema: timeOffSchema,
    successMessage: (d: { affectedAppointments: number }) =>
      d.affectedAppointments === 0
        ? "Absența a fost adăugată."
        : d.affectedAppointments === 1
          ? "Absența a fost adăugată. O programare este în acest interval: mutați-o din Calendar."
          : `Absența a fost adăugată. ${d.affectedAppointments} programări sunt în acest interval: mutați-le din Calendar.`,
  },
  async (input, { user }) => {
    const r = await createTimeOff(input, user);
    revalidateTimeOff();
    return r;
  },
);

export const deleteTimeOffAction = crmAction(
  { permission: "schedules.view", schema: z.object({ id: zId }), successMessage: "Absența a fost ștearsă." },
  async ({ id }, { user }) => {
    await deleteTimeOff(id, user);
    revalidateTimeOff();
    return null;
  },
);
