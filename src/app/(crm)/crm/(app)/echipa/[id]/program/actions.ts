"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crmAction } from "@/lib/actions";
import { zId } from "@/lib/validation/common";
import { confirmSchedule, deleteShift, saveShift, shiftSchema } from "@/server/scheduling/schedules";

/**
 * „Program” actions (docs/architecture.md §4.2 `/crm/echipa/[id]/program`, ADMIN only). Free slots
 * are computed from these rows on every request, so availability changes at once; the public
 * pages that show where a doctor works are revalidated.
 */

function revalidateSchedule(doctorId: string) {
  revalidatePath(`/crm/echipa/${doctorId}/program`);
  revalidatePath("/crm/programari");
  revalidatePath("/", "layout");
}

export const saveShiftAction = crmAction(
  { permission: "schedules.manage", schema: shiftSchema, successMessage: "Programul a fost salvat." },
  async (input, { user }) => {
    const shift = await saveShift(input, user);
    revalidateSchedule(input.doctorId);
    return shift;
  },
);

export const deleteShiftAction = crmAction(
  { permission: "schedules.manage", schema: z.object({ id: zId }), successMessage: "Intervalul a fost șters." },
  async ({ id }, { user }) => {
    const { doctorId } = await deleteShift(id, user);
    revalidateSchedule(doctorId);
    return null;
  },
);

/** Marks a demo schedule as checked by the administrator („program demonstrativ” disappears). */
export const confirmScheduleAction = crmAction(
  { permission: "schedules.manage", schema: z.object({ doctorId: zId }), successMessage: "Programul a fost confirmat." },
  async ({ doctorId }, { user }) => {
    await confirmSchedule(doctorId, user);
    revalidatePath(`/crm/echipa/${doctorId}/program`);
    return null;
  },
);
