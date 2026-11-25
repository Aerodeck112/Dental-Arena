"use server";

import { revalidatePath } from "next/cache";
import { assertRecordAccess } from "@/lib/clinic-scope";
import { crmAction } from "@/lib/actions";
import {
  addLeadActivity,
  assignLead,
  assignLeadSchema,
  changeLeadStatus,
  convertLead,
  convertLeadSchema,
  leadActivitySchema,
  leadStatusSchema,
} from "@/server/leads/pipeline";

/** Lead pipeline actions (WP6): assign, activity, status, conversion. */

function revalidateLeads(id?: string) {
  revalidatePath("/crm/cereri");
  revalidatePath("/crm");
  if (id) revalidatePath(`/crm/cereri/${id}`);
}

export const assignLeadAction = crmAction(
  { permission: "leads.manage", schema: assignLeadSchema, successMessage: (d: { assigned: boolean }) => (d.assigned ? "Cererea a fost atribuită." : "Atribuirea a fost scoasă.") },
  async (input, { user }) => {
    const to = input.assignedToId && input.assignedToId !== "none" ? input.assignedToId : null;
    await assertRecordAccess("lead", input.id);
    await assignLead(input.id, to, user);
    revalidateLeads(input.id);
    return { assigned: !!to };
  },
);

export const addLeadActivityAction = crmAction(
  {
    permission: "leads.manage",
    schema: leadActivitySchema,
    successMessage: (d: { statusChanged: boolean; note: boolean }) => (d.note ? "Nota a fost adăugată." : d.statusChanged ? "Apel notat. Cererea este acum Contactat." : "Contactul a fost notat."),
  },
  async (input, { user }) => {
    await assertRecordAccess("lead", input.id);
    const r = await addLeadActivity(input, user);
    revalidateLeads(input.id);
    return { ...r, note: input.type === "NOTA" };
  },
);

const STATUS_DONE = { NOU: "Cererea este din nou Nou.", CONTACTAT: "Cererea este Contactat.", PROGRAMAT: "Cererea este Programat.", PIERDUT: "Cererea a fost marcată Pierdut." } as const;

export const changeLeadStatusAction = crmAction(
  { permission: "leads.manage", schema: leadStatusSchema, successMessage: (d: { status: keyof typeof STATUS_DONE }) => STATUS_DONE[d.status] },
  async (input, { user }) => {
    await assertRecordAccess("lead", input.id);
    await changeLeadStatus(input, user);
    revalidateLeads(input.id);
    return { status: input.status };
  },
);

export const convertLeadAction = crmAction(
  {
    permission: "leads.manage",
    schema: convertLeadSchema,
    successMessage: (d: { createdPatient: boolean }) => (d.createdPatient ? "Pacient creat și programare legată." : "Programarea a fost legată de pacientul existent."),
  },
  async (input, { user }) => {
    await assertRecordAccess("lead", input.leadId);
    const r = await convertLead(input, user);
    revalidateLeads(input.leadId);
    revalidatePath("/crm/programari");
    revalidatePath("/crm/pacienti");
    return r;
  },
);
