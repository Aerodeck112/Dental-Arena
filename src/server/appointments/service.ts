import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma, type Db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { canActOnDoctorAppointment, can } from "@/lib/permissions";
import { addMonthsISO, isoWeekday, localToUtc, utcToLocal } from "@/lib/time";
import { optionalField, zCheckbox, zDateISO, zId, zOptionalText, zTimeHHMM } from "@/lib/validation/common";
import type { Appointment } from "@/generated/prisma/client";
import type { AppointmentStatus, Comfort } from "@/generated/prisma/enums";
import { assertConflictsAllowed, assertValidInterval, findConflicts, withSchedulingTx } from "@/server/scheduling/conflicts";
import { shiftValidOn } from "@/server/scheduling/compute";
import { searchPatientSummaries } from "@/server/patients/service";
import type { Conflict } from "@/server/scheduling/types";
import type { AppointmentFormOptions, PatientPick } from "./types";

/**
 * Appointments for the front desk (docs/architecture.md §6.2–§6.4, WP6): create, edit and move
 * with the full conflict check inside `withSchedulingTx`, ownership for MEDIC users, and the
 * recall created when a visit with `recallMonths` is finished. Status changes go through WP4's
 * `transitionAppointment`; notifications are the caller's job, after commit.
 */

const COMFORT = ["FARA_EMOTII", "EMOTII", "FRICA"] as const satisfies readonly Comfort[];
const MOVABLE: readonly AppointmentStatus[] = ["PROGRAMAT", "CONFIRMAT"];
const optId = optionalField(zId);

const durationSchema = z.coerce
  .number({ error: "Alegeți durata." })
  .int({ error: "Alegeți durata în minute." })
  .min(5, { error: "Durata trebuie să fie între 5 minute și 8 ore." })
  .max(480, { error: "Durata trebuie să fie între 5 minute și 8 ore." });

/** Fields shared by the quick-create popover, the full form and the edit form. */
const appointmentFields = {
  locationId: zId,
  doctorId: optId,
  cabinetId: optId,
  serviceId: optId,
  reason: zOptionalText(200),
  date: zDateISO,
  time: zTimeHHMM,
  durationMinutes: durationSchema,
  comfort: optionalField(z.enum(COMFORT)),
  comfortNote: zOptionalText(500),
  wantsSedation: zCheckbox,
  notes: zOptionalText(2000),
  acknowledgeWarnings: zCheckbox,
};

export const createAppointmentSchema = z.object({
  ...appointmentFields,
  patientId: optId,
  leadId: optId,
  recallId: optId,
  source: optionalField(z.enum(["TELEFON", "RECEPTIE", "RECHEMARE"])),
});
export type CreateAppointmentInput = z.output<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  ...appointmentFields,
  id: zId,
  expectedUpdatedAt: z.string().min(10),
  /** „Pacientul a confirmat noua oră”. */
  confirmed: zCheckbox,
});
export type UpdateAppointmentInput = z.output<typeof updateAppointmentSchema>;

export const moveAppointmentSchema = z.object({
  id: zId,
  expectedUpdatedAt: z.string().min(10),
  date: zDateISO,
  time: zTimeHHMM,
  /** Omitted: keep the current duration. */
  durationMinutes: optionalField(durationSchema),
  /** Omitted: keep the doctor. */
  doctorId: optId,
  /** Omitted: keep or derive from the doctor's shift; "none" = no cabinet. */
  cabinetId: optionalField(z.union([zId, z.literal("none")])),
  /** „Pacientul a confirmat noua oră”: the status stays (or becomes) Confirmat. */
  confirmed: zCheckbox,
  acknowledgeWarnings: zCheckbox,
  /** Undo of a previous move: no message to the patient. */
  undo: zCheckbox,
});
export type MoveAppointmentInput = z.output<typeof moveAppointmentSchema>;

function interval(date: string, time: number, duration: number): { startsAt: Date; endsAt: Date } {
  return { startsAt: localToUtc(date, time), endsAt: localToUtc(date, time + duration) };
}

// ───────────────────────────── Ownership ─────────────────────────────

/**
 * §5.2: with `appointments.manage` a user acts on any appointment; with `appointments.manageOwn`
 * (MEDIC) only where `doctorId` is their own. Throws NOT_FOUND / FORBIDDEN.
 */
export async function assertCanActOnAppointment(user: CurrentUser, id: string, db: Db = prisma): Promise<Appointment> {
  const appt = await db.appointment.findUnique({ where: { id } });
  if (!appt) throw new DomainError("NOT_FOUND", "Programarea nu mai există. Reîncărcați pagina.");
  if (!canActOnDoctorAppointment(user, appt.doctorId)) {
    throw new DomainError("FORBIDDEN", "Puteți modifica doar programările dumneavoastră.");
  }
  return appt;
}

/** The doctor a user may book for: a MEDIC without `appointments.manage` only for themselves. */
export function effectiveDoctorId(user: CurrentUser, requested: string | undefined | null): string {
  if (!can(user, "appointments.manage")) {
    if (!user.doctorId) throw new DomainError("FORBIDDEN", "Contul dumneavoastră nu este legat de un medic.");
    return user.doctorId;
  }
  if (!requested) throw new DomainError("VALIDATION", "Alegeți medicul.", { fieldErrors: { doctorId: ["Alegeți medicul."] } });
  return requested;
}

// ───────────────────────────── Lookups inside the transaction ─────────────────────────────

async function assertRefs(
  tx: Tx,
  r: { locationId: string; doctorId: string; cabinetId?: string | null; serviceId?: string | null; patientId?: string | null; leadId?: string | null },
) {
  const [location, doctor, cabinet, service, patient, lead] = await Promise.all([
    tx.location.findUnique({ where: { id: r.locationId }, select: { id: true, active: true } }),
    tx.doctor.findUnique({ where: { id: r.doctorId }, select: { id: true, active: true } }),
    r.cabinetId ? tx.cabinet.findUnique({ where: { id: r.cabinetId }, select: { id: true, locationId: true } }) : null,
    r.serviceId ? tx.service.findUnique({ where: { id: r.serviceId }, select: { id: true, active: true } }) : null,
    r.patientId ? tx.patient.findUnique({ where: { id: r.patientId }, select: { id: true, anonymizedAt: true } }) : null,
    r.leadId ? tx.lead.findUnique({ where: { id: r.leadId }, select: { id: true } }) : null,
  ]);
  const field = (name: string, msg: string): never => {
    throw new DomainError("VALIDATION", msg, { fieldErrors: { [name]: [msg] } });
  };
  if (!location?.active) field("locationId", "Alegeți o clinică activă.");
  if (!doctor?.active) field("doctorId", "Alegeți un medic activ.");
  if (r.cabinetId && cabinet?.locationId !== r.locationId) field("cabinetId", "Cabinetul ales nu aparține clinicii.");
  if (r.serviceId && !service?.active) field("serviceId", "Alegeți un serviciu activ.");
  if (r.patientId && (!patient || patient.anonymizedAt)) field("patientId", "Pacientul nu mai poate fi programat.");
  if (r.leadId && !lead) field("leadId", "Cererea nu mai există.");
}

/** The doctor's shift that contains `minute` on `date` (any location), for location and cabinet of a move. */
async function shiftAt(db: Db, doctorId: string, date: string, minute: number) {
  const weekday = isoWeekday(date);
  const shifts = await db.workShift.findMany({
    where: { doctorId, weekday, startMinute: { lte: minute }, endMinute: { gt: minute } },
    select: { locationId: true, cabinetId: true, validFrom: true, validUntil: true },
  });
  return shifts.find((s) => shiftValidOn(s, date)) ?? null;
}

// ───────────────────────────── Create ─────────────────────────────

export type SaveResult = { id: string; startsAt: Date; warnings: Conflict[] };

/**
 * Creates an appointment (CRM). A patient or a lead is required (§3.2 invariant 8). MEDIC users
 * book only for themselves. Conflicts are re-checked inside the transaction; warnings need
 * `acknowledgeWarnings` and the override right (§6.2). A recall passed as `recallId` is marked
 * PROGRAMAT with the new appointment.
 */
export async function createAppointment(i: CreateAppointmentInput, actor: CurrentUser, now: Date = new Date()): Promise<SaveResult> {
  const doctorId = effectiveDoctorId(actor, i.doctorId);
  if (!i.patientId && !i.leadId) {
    throw new DomainError("VALIDATION", "Alegeți pacientul sau adăugați unul nou.", {
      fieldErrors: { patientId: ["Alegeți pacientul sau adăugați unul nou."] },
    });
  }
  const { startsAt, endsAt } = interval(i.date, i.time, i.durationMinutes);
  assertValidInterval(startsAt, endsAt);

  return withSchedulingTx(async (tx) => {
    await assertRefs(tx, { locationId: i.locationId, doctorId, cabinetId: i.cabinetId, serviceId: i.serviceId, patientId: i.patientId, leadId: i.leadId });
    const recall = i.recallId ? await tx.recall.findUnique({ where: { id: i.recallId } }) : null;
    if (i.recallId && (!recall || recall.patientId !== i.patientId)) {
      throw new DomainError("VALIDATION", "Rechemarea nu corespunde pacientului ales.");
    }
    const conflicts = await findConflicts(
      tx,
      { locationId: i.locationId, doctorId, cabinetId: i.cabinetId ?? null, patientId: i.patientId ?? null, startsAt, endsAt, wantsSedation: i.wantsSedation },
      { now },
    );
    assertConflictsAllowed(conflicts, { acknowledgeWarnings: i.acknowledgeWarnings, user: actor, doctorId });
    const appt = await tx.appointment.create({
      data: {
        locationId: i.locationId,
        doctorId,
        cabinetId: i.cabinetId ?? null,
        patientId: i.patientId ?? null,
        leadId: i.leadId ?? null,
        serviceId: i.serviceId ?? null,
        reason: i.reason ?? null,
        startsAt,
        endsAt,
        status: "PROGRAMAT",
        source: i.recallId ? "RECHEMARE" : (i.source ?? "TELEFON"),
        comfort: i.comfort ?? null,
        comfortNote: i.comfortNote ?? null,
        wantsSedation: i.wantsSedation,
        notes: i.notes ?? null,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    if (recall) {
      await tx.recall.update({ where: { id: recall.id }, data: { status: "PROGRAMAT", bookedAppointmentId: appt.id } });
    }
    await audit(
      {
        action: "appointment.create",
        entityType: "Appointment",
        entityId: appt.id,
        patientId: appt.patientId,
        metadata: { source: appt.source, warnings: conflicts.map((c) => c.kind) },
      },
      { actor, db: tx },
    );
    return { id: appt.id, startsAt, warnings: conflicts.filter((c) => c.severity === "warn") };
  });
}

// ───────────────────────────── Update ─────────────────────────────

function assertMovable(status: AppointmentStatus) {
  if (!MOVABLE.includes(status)) {
    throw new DomainError("INVALID_TRANSITION", "Doar programările cu statusul Programat sau Confirmat pot fi mutate.");
  }
}

/** Status columns after a reschedule: Confirmat only when the patient confirmed the new time. */
function rescheduleStatus(current: AppointmentStatus, confirmed: boolean, now: Date) {
  if (confirmed) {
    return current === "CONFIRMAT"
      ? { status: "CONFIRMAT" as const }
      : { status: "CONFIRMAT" as const, confirmedAt: now, confirmedVia: "TELEFON" as const };
  }
  return { status: "PROGRAMAT" as const, confirmedAt: null, confirmedVia: null };
}

export type UpdateResult = { id: string; moved: boolean; status: AppointmentStatus; startsAt: Date };

/**
 * Edits an appointment (the full form on `/crm/programari/[id]`). Changing the time, doctor,
 * clinic or cabinet is a reschedule: allowed only in PROGRAMAT/CONFIRMAT, it re-runs the conflict
 * check, increments `tokenVersion` and clears `reminderSentAt` (§3.2 invariant 9).
 */
export async function updateAppointment(i: UpdateAppointmentInput, actor: CurrentUser, now: Date = new Date()): Promise<UpdateResult> {
  return withSchedulingTx(async (tx) => {
    const appt = await assertCanActOnAppointment(actor, i.id, tx);
    if (appt.updatedAt.toISOString() !== i.expectedUpdatedAt) throw new DomainError("STALE", "Programarea a fost modificată între timp. Reîncărcați pagina.");
    const doctorId = can(actor, "appointments.manage") ? (i.doctorId ?? appt.doctorId) : appt.doctorId;
    const { startsAt, endsAt } = interval(i.date, i.time, i.durationMinutes);
    assertValidInterval(startsAt, endsAt);
    const moved =
      startsAt.getTime() !== appt.startsAt.getTime() ||
      endsAt.getTime() !== appt.endsAt.getTime() ||
      doctorId !== appt.doctorId ||
      i.locationId !== appt.locationId ||
      (i.cabinetId ?? null) !== appt.cabinetId;
    if (moved) assertMovable(appt.status);
    await assertRefs(tx, { locationId: i.locationId, doctorId, cabinetId: i.cabinetId, serviceId: i.serviceId });
    if (moved || i.wantsSedation !== appt.wantsSedation) {
      const conflicts = await findConflicts(
        tx,
        { appointmentId: appt.id, locationId: i.locationId, doctorId, cabinetId: i.cabinetId ?? null, patientId: appt.patientId, startsAt, endsAt, wantsSedation: i.wantsSedation },
        { now },
      );
      assertConflictsAllowed(conflicts, { acknowledgeWarnings: i.acknowledgeWarnings, user: actor, doctorId });
    }
    const data = {
      locationId: i.locationId,
      doctorId,
      cabinetId: i.cabinetId ?? null,
      serviceId: i.serviceId ?? null,
      reason: i.reason ?? null,
      startsAt,
      endsAt,
      comfort: i.comfort ?? null,
      comfortNote: i.comfortNote ?? null,
      wantsSedation: i.wantsSedation,
      notes: i.notes ?? null,
      updatedById: actor.id,
      ...(moved ? { tokenVersion: { increment: 1 }, reminderSentAt: null, ...rescheduleStatus(appt.status, i.confirmed, now) } : {}),
    };
    const res = await tx.appointment.updateMany({ where: { id: appt.id, updatedAt: appt.updatedAt }, data });
    if (res.count !== 1) throw new DomainError("STALE", "Programarea a fost modificată între timp. Reîncărcați pagina.");
    const changed = Object.keys(data).filter((k) => {
      if (k === "updatedById" || k === "tokenVersion" || k === "reminderSentAt") return false;
      const before = (appt as Record<string, unknown>)[k];
      const after = (data as Record<string, unknown>)[k];
      return before instanceof Date && after instanceof Date ? before.getTime() !== after.getTime() : before !== after;
    });
    await audit(
      { action: moved ? "appointment.move" : "appointment.update", entityType: "Appointment", entityId: appt.id, patientId: appt.patientId, metadata: { fields: changed } },
      { actor, db: tx },
    );
    const status = moved ? rescheduleStatus(appt.status, i.confirmed, now).status : appt.status;
    return { id: appt.id, moved, status, startsAt };
  });
}

// ───────────────────────────── Move ─────────────────────────────

export type MoveResult = {
  id: string;
  startsAt: string;
  updatedAt: string;
  status: AppointmentStatus;
  tokenVersion: number;
  /** The values before the move, for „Anulați” (undo). */
  previous: { date: string; time: string; durationMinutes: number; doctorId: string; cabinetId: string | null; confirmed: boolean };
};

/**
 * `moveAppointment` (§6.4): only PROGRAMAT and CONFIRMAT; full conflict check; `tokenVersion++`
 * and `reminderSentAt = null`; the status stays Confirmat only with `confirmed`. A stale
 * `expectedUpdatedAt` returns STALE. Moving to another doctor takes the clinic and cabinet of
 * that doctor's shift at the new time.
 */
export async function moveAppointment(i: MoveAppointmentInput, actor: CurrentUser, now: Date = new Date()): Promise<MoveResult> {
  return withSchedulingTx(async (tx) => {
    const appt = await assertCanActOnAppointment(actor, i.id, tx);
    if (appt.updatedAt.toISOString() !== i.expectedUpdatedAt) {
      throw new DomainError("STALE", "Programarea a fost modificată între timp. Reîncărcați pagina.");
    }
    assertMovable(appt.status);
    const duration = i.durationMinutes ?? Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000);
    const doctorId = i.doctorId && can(actor, "appointments.manage") ? i.doctorId : appt.doctorId;
    if (i.doctorId && i.doctorId !== appt.doctorId && doctorId === appt.doctorId) {
      throw new DomainError("FORBIDDEN", "Puteți muta programarea doar în agenda dumneavoastră.");
    }
    let locationId = appt.locationId;
    let cabinetId: string | null = appt.cabinetId;
    if (i.cabinetId === "none") cabinetId = null;
    else if (i.cabinetId) {
      const cab = await tx.cabinet.findUnique({ where: { id: i.cabinetId }, select: { locationId: true } });
      if (!cab) throw new DomainError("VALIDATION", "Cabinetul ales nu mai există.");
      cabinetId = i.cabinetId;
      locationId = cab.locationId;
    } else if (doctorId !== appt.doctorId) {
      const shift = await shiftAt(tx, doctorId, i.date, i.time);
      if (shift) {
        locationId = shift.locationId;
        cabinetId = shift.cabinetId;
      } else {
        cabinetId = null;
      }
    }
    const { startsAt, endsAt } = interval(i.date, i.time, duration);
    assertValidInterval(startsAt, endsAt);
    await assertRefs(tx, { locationId, doctorId, cabinetId });
    const conflicts = await findConflicts(
      tx,
      { appointmentId: appt.id, locationId, doctorId, cabinetId, patientId: appt.patientId, startsAt, endsAt, wantsSedation: appt.wantsSedation },
      { now },
    );
    assertConflictsAllowed(conflicts, { acknowledgeWarnings: i.acknowledgeWarnings, user: actor, doctorId });
    const res = await tx.appointment.updateMany({
      where: { id: appt.id, updatedAt: appt.updatedAt },
      data: {
        startsAt,
        endsAt,
        doctorId,
        locationId,
        cabinetId,
        tokenVersion: { increment: 1 },
        reminderSentAt: null,
        updatedById: actor.id,
        ...rescheduleStatus(appt.status, i.confirmed, now),
      },
    });
    if (res.count !== 1) throw new DomainError("STALE", "Programarea a fost modificată între timp. Reîncărcați pagina.");
    await audit(
      {
        action: "appointment.move",
        entityType: "Appointment",
        entityId: appt.id,
        patientId: appt.patientId,
        metadata: { fields: ["startsAt", "endsAt", ...(doctorId !== appt.doctorId ? ["doctorId"] : []), ...(cabinetId !== appt.cabinetId ? ["cabinetId"] : [])], undo: i.undo },
      },
      { actor, db: tx },
    );
    const fresh = await tx.appointment.findUniqueOrThrow({ where: { id: appt.id }, select: { updatedAt: true, status: true, tokenVersion: true } });
    const prevLocal = utcToLocal(appt.startsAt);
    return {
      id: appt.id,
      startsAt: startsAt.toISOString(),
      updatedAt: fresh.updatedAt.toISOString(),
      status: fresh.status,
      tokenVersion: fresh.tokenVersion,
      previous: {
        date: prevLocal.dateISO,
        time: minutesToClock(prevLocal.minute),
        durationMinutes: Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000),
        doctorId: appt.doctorId,
        cabinetId: appt.cabinetId,
        confirmed: appt.status === "CONFIRMAT",
      },
    };
  });
}

function minutesToClock(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** True when the appointment still carries the token version a move produced (no later change). */
export async function isStillVersion(id: string, tokenVersion: number): Promise<boolean> {
  const row = await prisma.appointment.findUnique({ where: { id }, select: { tokenVersion: true, status: true } });
  return !!row && row.tokenVersion === tokenVersion && MOVABLE.includes(row.status);
}

// ───────────────────────────── After a status change ─────────────────────────────

/** Default recall reason: „Control la 6 luni după detartraj”. */
export function recallReason(serviceName: string, months: number): string {
  const what = serviceName.charAt(0).toLocaleLowerCase("ro-RO") + serviceName.slice(1);
  return `Control la ${months} ${months === 1 ? "lună" : "luni"} după ${what}`;
}

/** Due date (local `YYYY-MM-DD`) of a recall: completion date plus `months`. Pure. */
export function recallDueDateISO(completedAt: Date, months: number): string {
  return addMonthsISO(utcToLocal(completedAt).dateISO, months);
}

/**
 * §6.4: after FINALIZAT, when the service has `recallMonths`, creates `Recall { dueDate =
 * completedAt + recallMonths }`, unless an open recall (De făcut / Contactat) already exists for
 * the patient and the same service. Returns the new recall id, or null.
 */
export async function createRecallForCompleted(appointmentId: string, db: Db = prisma, actor?: CurrentUser | null): Promise<string | null> {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      completedAt: true,
      patientId: true,
      locationId: true,
      doctorId: true,
      serviceId: true,
      service: { select: { name: true, recallMonths: true } },
    },
  });
  if (!appt || appt.status !== "FINALIZAT" || !appt.patientId || !appt.completedAt) return null;
  const months = appt.service?.recallMonths;
  if (!months || months <= 0 || !appt.service) return null;
  const reason = recallReason(appt.service.name, months);
  const open = await db.recall.findMany({
    where: { patientId: appt.patientId, status: { in: ["DE_FACUT", "CONTACTAT"] } },
    select: { reason: true, sourceAppointmentId: true },
  });
  if (open.some((r) => r.reason === reason)) return null;
  const sourceIds = open.map((r) => r.sourceAppointmentId).filter((v): v is string => !!v);
  if (sourceIds.length > 0) {
    const sameService = await db.appointment.count({ where: { id: { in: sourceIds }, serviceId: appt.serviceId } });
    if (sameService > 0) return null;
  }
  const recall = await db.recall.create({
    data: {
      patientId: appt.patientId,
      locationId: appt.locationId,
      doctorId: appt.doctorId,
      reason,
      dueDate: localToUtc(recallDueDateISO(appt.completedAt, months), 0),
      sourceAppointmentId: appt.id,
      createdById: actor?.id ?? null,
    },
    select: { id: true },
  });
  return recall.id;
}

/**
 * Bookkeeping after a status change made from the CRM: a confirmed or cancelled appointment of a
 * lead that is still „Nou” moves the lead to „Contactat” with an activity line.
 */
export async function touchLeadAfterTransition(appointmentId: string, to: AppointmentStatus, actor: CurrentUser): Promise<void> {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { leadId: true } });
  if (!appt?.leadId || (to !== "CONFIRMAT" && to !== "ANULAT")) return;
  const lead = await prisma.lead.findUnique({ where: { id: appt.leadId }, select: { status: true, contactedAt: true } });
  if (!lead) return;
  await prisma.$transaction(async (tx) => {
    await tx.leadActivity.create({
      data: {
        leadId: appt.leadId!,
        type: "STATUS",
        body: to === "CONFIRMAT" ? "Programarea a fost confirmată telefonic." : "Programarea a fost anulată.",
        authorId: actor.id,
      },
    });
    if (lead.status === "NOU") {
      await tx.lead.update({ where: { id: appt.leadId! }, data: { status: "CONTACTAT", contactedAt: lead.contactedAt ?? new Date() } });
    }
  });
}

// ───────────────────────────── Form options and pickers ─────────────────────────────

/** Clinics, doctors (with the clinics where they have shifts), cabinets and services for the forms. */
export async function getAppointmentFormOptions(user: CurrentUser): Promise<AppointmentFormOptions> {
  const [locations, doctors, cabinets, services] = await Promise.all([
    prisma.location.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, shortName: true } }),
    prisma.doctor.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
      select: { id: true, publicName: true, shifts: { select: { locationId: true } } },
    }),
    prisma.cabinet.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, locationId: true } }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, durationMinutes: true, category: { select: { name: true } } },
    }),
  ]);
  return {
    locations,
    doctors: doctors.map((d) => ({ id: d.id, name: d.publicName, locationIds: [...new Set(d.shifts.map((s) => s.locationId))] })),
    cabinets,
    services: services.map((s) => ({ id: s.id, name: s.name, categoryName: s.category.name, durationMinutes: s.durationMinutes })),
    forcedDoctorId: can(user, "appointments.manage") ? null : user.doctorId,
    canOverride: can(user, "appointments.override"),
    role: user.role,
  };
}

/** Patient search for the quick-create picker (name or phone, at least 2 characters). */
export async function searchPatientsForPicker(q: string): Promise<PatientPick[]> {
  const rows = await searchPatientSummaries(q, 8);
  return rows.map((r) => ({ id: r.id, fileNumber: r.fileNumber, name: r.name, phone: r.phone, birthDate: r.birthDate }));
}

/** The patient as a picker row (prefill from `?pacient=`). */
export async function getPatientPick(id: string): Promise<PatientPick | null> {
  const p = await prisma.patient.findUnique({
    where: { id },
    select: { id: true, fileNumber: true, firstName: true, lastName: true, phone: true, birthDate: true, anonymizedAt: true },
  });
  if (!p || p.anonymizedAt) return null;
  return {
    id: p.id,
    fileNumber: p.fileNumber,
    name: personName(p),
    phone: p.phone,
    birthDate: p.birthDate ? utcToLocal(p.birthDate).dateISO : null,
  };
}
