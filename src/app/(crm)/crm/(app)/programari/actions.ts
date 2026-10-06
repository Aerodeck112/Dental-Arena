"use server";

import { revalidatePath } from "next/cache";
import { assertLocationAccess, assertRecordAccess } from "@/lib/clinic-scope";
import { after } from "next/server";
import { z } from "zod";
import { crmAction, DomainError } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatTime } from "@/lib/format";
import { optionalField, zDateISO, zCheckbox, zId, zOptionalEmail, zOptionalText, zPhoneRo, zText } from "@/lib/validation/common";
import {
  assertCanActOnAppointment,
  createAppointment,
  createAppointmentSchema,
  createRecallForCompleted,
  isStillVersion,
  moveAppointment,
  moveAppointmentSchema,
  searchPatientsForPicker,
  touchLeadAfterTransition,
  updateAppointment,
  updateAppointmentSchema,
} from "@/server/appointments/service";
import type { PatientPick } from "@/server/appointments/types";
import { sendAppointmentMessage } from "@/server/notify/send";
import { findDuplicatePatients } from "@/server/patients/duplicates";
import { createPatient } from "@/server/patients/service";
import { transitionAppointment } from "@/server/scheduling/status";

/** Calendar, appointment form and drawer actions (WP6). Each one parses, authorises and calls one service. */

const MANAGE = ["appointments.manage", "appointments.manageOwn"] as const;
/** The undo toast stays 6 s (design system §8). */
const UNDO_WINDOW_MS = 6000;

function revalidateAgenda(appointmentId?: string) {
  revalidatePath("/crm/programari");
  revalidatePath("/crm");
  if (appointmentId) revalidatePath(`/crm/programari/${appointmentId}`);
}

export const createAppointmentAction = crmAction(
  { permission: [...MANAGE], schema: createAppointmentSchema, successMessage: (d: { time: string }) => `Programare creată pentru ora ${d.time}` },
  async (input, { user }) => {
    await assertLocationAccess(input.locationId);
    const r = await createAppointment(input, user);
    revalidateAgenda(r.id);
    if (input.leadId) revalidatePath("/crm/cereri");
    if (input.recallId) revalidatePath("/crm/rechemari");
    return { id: r.id, time: formatTime(r.startsAt), dateISO: input.date };
  },
);

export const updateAppointmentAction = crmAction(
  { permission: [...MANAGE], schema: updateAppointmentSchema, successMessage: (d: { moved: boolean; time: string }) => (d.moved ? `Programare mutată la ${d.time}` : "Modificările au fost salvate.") },
  async (input, { user }) => {
    await assertRecordAccess("appointment", input.id);
    await assertLocationAccess(input.locationId);
    const r = await updateAppointment(input, user);
    revalidateAgenda(r.id);
    if (r.moved) {
      const version = (await prisma.appointment.findUnique({ where: { id: r.id }, select: { tokenVersion: true } }))?.tokenVersion;
      if (version !== undefined) scheduleMovedMessage(r.id, version, user.id);
    }
    return { id: r.id, moved: r.moved, time: formatTime(r.startsAt) };
  },
);

/** MODIFICARE goes out after the undo window, and only if nothing changed the appointment since. */
function scheduleMovedMessage(id: string, tokenVersion: number, userId: string) {
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, UNDO_WINDOW_MS + 1500));
    if (await isStillVersion(id, tokenVersion)) await sendAppointmentMessage("MODIFICARE", id, { sentById: userId });
  });
}

export const moveAppointmentAction = crmAction(
  { permission: [...MANAGE], schema: moveAppointmentSchema, successMessage: (d: { undo: boolean; time: string }) => (d.undo ? "Mutarea a fost anulată." : `Programare mutată la ${d.time}`) },
  async (input, { user }) => {
    await assertRecordAccess("appointment", input.id);
    const r = await moveAppointment(input, user);
    if (!input.undo) scheduleMovedMessage(r.id, r.tokenVersion, user.id);
    revalidateAgenda(r.id);
    return { ...r, time: formatTime(new Date(r.startsAt)), undo: input.undo };
  },
);

const STATUS_MESSAGE = {
  PROGRAMAT: "Programarea a revenit la Programat",
  CONFIRMAT: "Programare confirmată",
  SOSIT: "Pacientul a sosit",
  IN_TRATAMENT: "Tratament început",
  FINALIZAT: "Vizită finalizată",
  ANULAT: "Programare anulată",
  NEPREZENTAT: "Marcat ca neprezentat",
} as const;

export const changeStatusAction = crmAction(
  {
    permission: [...MANAGE],
    schema: z.object({
      id: zId,
      to: z.enum(["PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT", "ANULAT", "NEPREZENTAT"]),
      cancelledBy: optionalField(z.enum(["PACIENT", "CLINICA"])),
      reason: zOptionalText(500),
    }),
    successMessage: (d: { status: keyof typeof STATUS_MESSAGE }) => STATUS_MESSAGE[d.status],
  },
  async (input, { user }) => {
    await assertRecordAccess("appointment", input.id);
    await assertCanActOnAppointment(user, input.id);
    const appt = await transitionAppointment(input.id, input.to, {
      actor: user,
      via: input.to === "CONFIRMAT" ? "TELEFON" : undefined,
      cancelledBy: input.to === "ANULAT" ? (input.cancelledBy ?? "PACIENT") : undefined,
      reason: input.reason,
    });
    let recallId: string | null = null;
    if (input.to === "FINALIZAT") recallId = await createRecallForCompleted(appt.id, prisma, user);
    await touchLeadAfterTransition(appt.id, input.to, user);
    if (input.to === "CONFIRMAT") {
      after(() => sendAppointmentMessage("CONFIRMARE_PROGRAMARE", appt.id, { channels: ["SMS"], sentById: user.id }).then(() => undefined));
    }
    if (input.to === "ANULAT" && input.cancelledBy === "CLINICA") {
      after(() => sendAppointmentMessage("ANULARE", appt.id, { sentById: user.id }).then(() => undefined));
    }
    revalidateAgenda(appt.id);
    if (appt.leadId) revalidatePath("/crm/cereri");
    if (recallId) revalidatePath("/crm/rechemari");
    return { id: appt.id, status: appt.status, updatedAt: appt.updatedAt.toISOString(), recallCreated: !!recallId };
  },
);

export const searchPatientsAction = crmAction(
  { permission: "patients.view", schema: z.object({ q: z.string().trim().max(80) }) },
  async ({ q }): Promise<PatientPick[]> => searchPatientsForPicker(q),
);

const inlinePatientSchema = z.object({
  firstName: zText(80),
  lastName: zText(80),
  phone: optionalField(zPhoneRo),
  email: zOptionalEmail,
  birthDate: optionalField(zDateISO),
  ignoreDuplicates: zCheckbox,
});

/**
 * „Pacient nou” inside the appointment form: checks duplicates first (`findDuplicatePatients`)
 * and refuses with the list, unless the user confirms a new file.
 */
export const createPatientInlineAction = crmAction(
  { permission: "patients.create", schema: inlinePatientSchema, successMessage: "Pacient adăugat" },
  async (input, { user }): Promise<PatientPick> => {
    if (!input.ignoreDuplicates) {
      const duplicates = (await findDuplicatePatients(input)).filter((d) => !d.anonymized);
      if (duplicates.length > 0) {
        throw new DomainError("CONFLICT", "Există deja pacienți cu aceleași date. Alegeți unul sau creați totuși o fișă nouă.", {
          details: { duplicates },
        });
      }
    }
    const p = await createPatient(
      prisma,
      { firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null, email: input.email ?? null, birthDate: input.birthDate ?? null, acquisitionSource: "TELEFON" },
      user,
    );
    revalidatePath("/crm/pacienti");
    return { id: p.id, fileNumber: p.fileNumber, name: `${p.firstName} ${p.lastName}`, phone: p.phone, birthDate: input.birthDate ?? null };
  },
);
