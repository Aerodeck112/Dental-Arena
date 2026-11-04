import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { formatYears, personName } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { normalizeSearch } from "@/lib/search";
import { localToUtc } from "@/lib/time";
import { optionalField, zCheckbox, zDateISO, zId, zOptionalEmail, zOptionalText, zPhoneRo, zText, zTimeHHMM } from "@/lib/validation/common";
import type { Prisma } from "@/generated/prisma/client";
import type { ConsentMethod, ConsentType, LeadSource, LeadStatus } from "@/generated/prisma/enums";
import { shortDoctorName } from "@/server/appointments/calendar";
import { effectiveDoctorId } from "@/server/appointments/service";
import type { LeadCardDTO, LeadDetailDTO, LeadFilters } from "@/server/appointments/types";
import { findDuplicatePatients } from "@/server/patients/duplicates";
import { createPatient } from "@/server/patients/service";
import type { PatientSummary } from "@/server/patients/types";
import { assertConflictsAllowed, assertValidInterval, findConflicts, withSchedulingTx } from "@/server/scheduling/conflicts";

/**
 * Lead pipeline („Cereri”, WP6): Nou → Contactat → Programat, or Pierdut with a reason.
 * Assignment and activity lines, status changes and the conversion into a patient plus an
 * appointment (docs/architecture.md §11 WP6, §8.4 consent evidence).
 */

export const LEAD_STATUSES: readonly LeadStatus[] = ["NOU", "CONTACTAT", "PROGRAMAT", "PIERDUT"];
const OPEN_APPOINTMENT = ["PROGRAMAT", "CONFIRMAT"] as const;

// ───────────────────────────── Pure rules ─────────────────────────────

/**
 * Why a manual status change is refused, or null when it is allowed. „Programat” is reached only
 * through conversion (a patient is needed), unless the lead already has one; „Pierdut” needs a
 * reason.
 */
export function leadStatusProblem(
  from: LeadStatus,
  to: LeadStatus,
  o: { hasPatient: boolean; lostReason?: string | null },
): string | null {
  if (from === to) return "Cererea are deja acest status.";
  if (to === "PROGRAMAT" && !o.hasPatient) return "Pentru „Programat” convertiți cererea: alegeți pacientul și ora.";
  if (to === "PIERDUT" && !o.lostReason?.trim()) return "Scrieți motivul pentru care cererea este pierdută.";
  return null;
}

/** „Maria Suciu” → { firstName: "Maria", lastName: "Suciu" }; the first word is the first name. */
export function splitLeadName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Patient fields suggested for conversion. A booking for a child suggests the child, with the parent's surname. */
export function suggestedPatient(lead: {
  name: string;
  phone: string | null;
  email: string | null;
  forChild: boolean;
  childFirstName: string | null;
}): { firstName: string; lastName: string; phone: string | null; email: string | null } {
  const parent = splitLeadName(lead.name);
  if (lead.forChild && lead.childFirstName?.trim()) {
    return { firstName: lead.childFirstName.trim(), lastName: parent.lastName || parent.firstName, phone: lead.phone, email: lead.email };
  }
  return { ...parent, phone: lead.phone, email: lead.email };
}

export type ConsentRow = {
  patientId: string;
  type: ConsentType;
  granted: boolean;
  method: ConsentMethod;
  textVersion: string;
  grantedAt: Date;
  ipHash: string | null;
  recordedById: string;
  notes: string;
};

/**
 * §8.4: the consents a lead gave online become `Consent` rows of the patient:
 * GDPR_DATE_SANATATE (FORMULAR_ONLINE) when `consentGdprAt` is set, and SMS when `consentSms`.
 * Pure.
 */
export function leadConsentRows(
  lead: { consentGdprAt: Date | null; consentTextVersion: string | null; consentSms: boolean; ipHash: string | null; createdAt: Date; source: LeadSource },
  patientId: string,
  actorId: string,
  fallbackVersion: string,
): ConsentRow[] {
  const rows: ConsentRow[] = [];
  const method: ConsentMethod = "FORMULAR_ONLINE";
  const notes = "Preluat din cererea online";
  if (lead.consentGdprAt) {
    rows.push({
      patientId,
      type: "GDPR_DATE_SANATATE",
      granted: true,
      method,
      textVersion: lead.consentTextVersion ?? fallbackVersion,
      grantedAt: lead.consentGdprAt,
      ipHash: lead.ipHash,
      recordedById: actorId,
      notes,
    });
  }
  if (lead.consentSms) {
    rows.push({
      patientId,
      type: "SMS",
      granted: true,
      method,
      textVersion: lead.consentTextVersion ?? fallbackVersion,
      grantedAt: lead.consentGdprAt ?? lead.createdAt,
      ipHash: lead.ipHash,
      recordedById: actorId,
      notes,
    });
  }
  return rows;
}

// ───────────────────────────── Reads ─────────────────────────────

const LEAD_CARD_SELECT = {
  id: true,
  status: true,
  source: true,
  name: true,
  phone: true,
  email: true,
  createdAt: true,
  locationId: true,
  preferredTime: true,
  comfort: true,
  wantsSedation: true,
  forChild: true,
  childFirstName: true,
  childAge: true,
  assignedToId: true,
  patientId: true,
  lostReason: true,
  location: { select: { shortName: true } },
  service: { select: { name: true } },
  assignedTo: { select: { firstName: true, lastName: true } },
  activities: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
  appointments: {
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      patientId: true,
      doctor: { select: { honorific: true, lastName: true } },
      location: { select: { shortName: true } },
    },
  },
} satisfies Prisma.LeadSelect;

type LeadCardRow = Prisma.LeadGetPayload<{ select: typeof LEAD_CARD_SELECT }>;

function childLabel(l: { forChild: boolean; childFirstName: string | null; childAge: number | null }): string | null {
  if (!l.forChild) return null;
  return ["Copil", l.childFirstName?.trim(), l.childAge != null ? formatYears(l.childAge) : null].filter(Boolean).join(", ");
}

function toCard(l: LeadCardRow): LeadCardDTO {
  const open = l.appointments.find((a) => (OPEN_APPOINTMENT as readonly string[]).includes(a.status)) ?? null;
  return {
    id: l.id,
    status: l.status,
    source: l.source,
    name: l.name,
    phone: l.phone,
    email: l.email,
    createdAt: l.createdAt.toISOString(),
    locationId: l.locationId,
    locationName: l.location?.shortName ?? null,
    serviceName: l.service?.name ?? null,
    preferredTime: l.preferredTime,
    comfort: l.comfort,
    wantsSedation: l.wantsSedation,
    forChild: l.forChild,
    childLabel: childLabel(l),
    assignedToId: l.assignedToId,
    assignedToName: l.assignedTo ? personName(l.assignedTo) : null,
    patientId: l.patientId,
    lostReason: l.lostReason,
    lastActivityAt: l.activities[0]?.createdAt.toISOString() ?? null,
    appointment: open
      ? { id: open.id, startsAt: open.startsAt.toISOString(), status: open.status, doctorName: shortDoctorName(open.doctor), locationName: open.location.shortName }
      : null,
  };
}

/** Closed columns (Programat, Pierdut) show the last 30 days unless filtered by status. */
export const CLOSED_LEAD_DAYS = 30;

export async function listLeads(f: LeadFilters, now: Date = new Date()): Promise<LeadCardDTO[]> {
  const since = new Date(now.getTime() - CLOSED_LEAD_DAYS * 86_400_000);
  const where: Prisma.LeadWhereInput = {
    AND: [
      f.locationIds ? { OR: [{ locationId: { in: f.locationIds } }, { locationId: null }] } : {},
      f.status ? { status: f.status } : { OR: [{ status: { in: ["NOU", "CONTACTAT"] } }, { updatedAt: { gte: since } }] },
      f.source ? { source: f.source } : {},
      f.assignedToId === "none" ? { assignedToId: null } : f.assignedToId ? { assignedToId: f.assignedToId } : {},
    ],
  };
  const rows = await prisma.lead.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 300, select: LEAD_CARD_SELECT });
  const q = f.q ? normalizeSearch(f.q) : "";
  const digits = f.q?.replace(/\D/g, "") ?? "";
  return rows
    .filter((l) => {
      if (!q) return true;
      if (normalizeSearch(l.name).includes(q)) return true;
      return digits.length >= 3 && !!l.phone && l.phone.replace(/\D/g, "").includes(digits.replace(/^0/, ""));
    })
    .map(toCard);
}

export async function getLeadDetail(id: string): Promise<LeadDetailDTO | null> {
  const l = await prisma.lead.findUnique({
    where: { id },
    select: {
      ...LEAD_CARD_SELECT,
      message: true,
      comfortNote: true,
      consentGdprAt: true,
      consentTextVersion: true,
      consentSms: true,
      sourcePath: true,
      contactedAt: true,
      convertedAt: true,
      patient: { select: { firstName: true, lastName: true, fileNumber: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, type: true, body: true, createdAt: true, author: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!l) return null;
  const card = toCard({ ...l, activities: l.activities.slice(0, 1) });
  return {
    ...card,
    message: l.message,
    comfortNote: l.comfortNote,
    consentGdprAt: l.consentGdprAt?.toISOString() ?? null,
    consentTextVersion: l.consentTextVersion,
    consentSms: l.consentSms,
    sourcePath: l.sourcePath,
    contactedAt: l.contactedAt?.toISOString() ?? null,
    convertedAt: l.convertedAt?.toISOString() ?? null,
    patientName: l.patient ? personName(l.patient) : null,
    patientFileNumber: l.patient?.fileNumber ?? null,
    activities: l.activities.map((a) => ({
      id: a.id,
      type: a.type,
      body: a.body,
      authorName: a.author ? personName(a.author) : null,
      createdAt: a.createdAt.toISOString(),
    })),
    appointments: l.appointments.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      status: a.status,
      doctorName: shortDoctorName(a.doctor),
      locationName: a.location.shortName,
      tentative: a.patientId === null,
    })),
    suggested: suggestedPatient(l),
  };
}

/** Users who may own a lead (A/R, active). */
export async function listLeadAssignees(): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "RECEPTIE"] } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  return users.map((u) => ({ id: u.id, name: personName(u) }));
}

// ───────────────────────────── Writes ─────────────────────────────

async function loadLead(tx: Tx, id: string) {
  const lead = await tx.lead.findUnique({ where: { id } });
  if (!lead) throw new DomainError("NOT_FOUND", "Cererea nu mai există. Reîncărcați pagina.");
  return lead;
}

export const assignLeadSchema = z.object({ id: zId, assignedToId: optionalField(z.union([zId, z.literal("none")])) });

export async function assignLead(id: string, assignedToId: string | null, actor: CurrentUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, id);
    if (lead.assignedToId === assignedToId) return;
    let name = "nimeni";
    if (assignedToId) {
      const u = await tx.user.findUnique({ where: { id: assignedToId }, select: { firstName: true, lastName: true, active: true, role: true } });
      if (!u || !u.active || u.role === "MEDIC") throw new DomainError("VALIDATION", "Alegeți o persoană de la recepție sau un administrator.");
      name = personName(u);
    }
    await tx.lead.update({ where: { id }, data: { assignedToId } });
    await tx.leadActivity.create({ data: { leadId: id, type: "ATRIBUIRE", body: assignedToId ? `Atribuită lui ${name}.` : "Atribuirea a fost scoasă.", authorId: actor.id } });
    await audit({ action: "lead.update", entityType: "Lead", entityId: id, patientId: lead.patientId, metadata: { fields: ["assignedToId"] } }, { actor, db: tx });
  });
}

export const leadActivitySchema = z.object({
  id: zId,
  type: z.enum(["NOTA", "APEL", "SMS", "EMAIL"]),
  body: zText(2000),
});

/**
 * A note or a contact line (call, SMS, e-mail). Contacting a lead that is still „Nou” moves it
 * to „Contactat”.
 */
export async function addLeadActivity(i: z.output<typeof leadActivitySchema>, actor: CurrentUser, now: Date = new Date()): Promise<{ statusChanged: boolean }> {
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, i.id);
    await tx.leadActivity.create({ data: { leadId: lead.id, type: i.type, body: i.body, authorId: actor.id } });
    const contact = i.type !== "NOTA";
    const statusChanged = contact && lead.status === "NOU";
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        ...(statusChanged ? { status: "CONTACTAT" as const } : {}),
        ...(contact && !lead.contactedAt ? { contactedAt: now } : {}),
        ...(!lead.assignedToId && actor.role !== "MEDIC" ? { assignedToId: actor.id } : {}),
      },
    });
    if (statusChanged) {
      await tx.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", body: "Nou → Contactat", authorId: actor.id } });
    }
    await audit({ action: "lead.update", entityType: "Lead", entityId: lead.id, patientId: lead.patientId, metadata: { fields: ["activities", ...(statusChanged ? ["status"] : [])] } }, { actor, db: tx });
    return { statusChanged };
  });
}

export const leadStatusSchema = z.object({
  id: zId,
  status: z.enum(["NOU", "CONTACTAT", "PROGRAMAT", "PIERDUT"]),
  lostReason: zOptionalText(500),
});

const STATUS_WORD: Record<LeadStatus, string> = { NOU: "Nou", CONTACTAT: "Contactat", PROGRAMAT: "Programat", PIERDUT: "Pierdut" };

export async function changeLeadStatus(i: z.output<typeof leadStatusSchema>, actor: CurrentUser, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, i.id);
    const problem = leadStatusProblem(lead.status, i.status, { hasPatient: !!lead.patientId, lostReason: i.lostReason });
    if (problem) {
      throw new DomainError("VALIDATION", problem, i.status === "PIERDUT" ? { fieldErrors: { lostReason: [problem] } } : undefined);
    }
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: i.status,
        lostReason: i.status === "PIERDUT" ? i.lostReason!.trim() : null,
        ...(i.status === "CONTACTAT" && !lead.contactedAt ? { contactedAt: now } : {}),
      },
    });
    const body = `${STATUS_WORD[lead.status]} → ${STATUS_WORD[i.status]}${i.status === "PIERDUT" ? `: ${i.lostReason!.trim()}` : ""}`;
    await tx.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", body, authorId: actor.id } });
    await audit({ action: "lead.update", entityType: "Lead", entityId: lead.id, patientId: lead.patientId, metadata: { fields: ["status", ...(i.status === "PIERDUT" ? ["lostReason"] : [])] } }, { actor, db: tx });
  });
}

// ───────────────────────────── Conversion ─────────────────────────────

const optId = optionalField(zId);

export const convertLeadSchema = z.object({
  leadId: zId,
  mode: z.enum(["existent", "nou"]),
  patientId: optId,
  firstName: zOptionalText(80),
  lastName: zOptionalText(80),
  phone: optionalField(zPhoneRo),
  email: zOptionalEmail,
  birthDate: optionalField(zDateISO),
  /** „Creați pacient nou” after seeing the duplicates. */
  ignoreDuplicates: zCheckbox,
  /** Used when the lead has no open tentative appointment. */
  locationId: optId,
  doctorId: optId,
  serviceId: optId,
  date: optionalField(zDateISO),
  time: optionalField(zTimeHHMM),
  durationMinutes: optionalField(z.coerce.number().int().min(5).max(480)),
  acknowledgeWarnings: zCheckbox,
});
export type ConvertLeadInput = z.output<typeof convertLeadSchema>;

export type ConvertResult = { patientId: string; appointmentId: string; createdPatient: boolean };

function fieldError(field: string, message: string): never {
  throw new DomainError("VALIDATION", message, { fieldErrors: { [field]: [message] } });
}

/** Duplicates of the would-be patient (phone, e-mail, name with birth date). */
export async function leadDuplicates(q: { phone?: string | null; email?: string | null; firstName?: string; lastName?: string; birthDate?: string | null }): Promise<PatientSummary[]> {
  const found = await findDuplicatePatients(q);
  return found.filter((p) => !p.anonymized);
}

/**
 * Converts a lead (WP6 acceptance):
 * 1. the patient is the chosen existing one, or a new one (refused with the duplicates unless
 *    `ignoreDuplicates`);
 * 2. the lead's GDPR and SMS consents are copied into `Consent` rows;
 * 3. the tentative appointments get the `patientId`, or a new appointment is created (full
 *    conflict check);
 * 4. the lead becomes PROGRAMAT with `convertedAt`;
 * 5. `lead.convert` is audited.
 * Everything runs in one scheduling transaction.
 */
export async function convertLead(i: ConvertLeadInput, actor: CurrentUser, now: Date = new Date()): Promise<ConvertResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: i.leadId },
    include: { appointments: { select: { id: true, status: true, patientId: true } } },
  });
  if (!lead) throw new DomainError("NOT_FOUND", "Cererea nu mai există. Reîncărcați pagina.");
  if (lead.convertedAt && lead.patientId) throw new DomainError("CONFLICT", "Cererea a fost deja convertită în pacient.");

  if (i.mode === "existent" && !i.patientId) fieldError("patientId", "Alegeți pacientul existent.");
  if (i.mode === "nou") {
    if (!i.firstName) fieldError("firstName", "Completați prenumele.");
    if (!i.lastName) fieldError("lastName", "Completați numele.");
    if (!i.ignoreDuplicates) {
      const duplicates = await leadDuplicates({ phone: i.phone, email: i.email, firstName: i.firstName, lastName: i.lastName, birthDate: i.birthDate });
      if (duplicates.length > 0) {
        throw new DomainError("CONFLICT", "Există deja pacienți cu aceleași date. Folosiți pacientul existent sau confirmați un pacient nou.", {
          details: { duplicates },
        });
      }
    }
  }

  const tentative = lead.appointments.filter((a) => a.patientId === null && (OPEN_APPOINTMENT as readonly string[]).includes(a.status));
  let newAppt: { locationId: string; doctorId: string; serviceId: string | null; startsAt: Date; endsAt: Date } | null = null;
  if (tentative.length === 0) {
    if (!i.locationId) fieldError("locationId", "Alegeți clinica.");
    if (!i.date) fieldError("date", "Alegeți ziua programării.");
    if (i.time === undefined) fieldError("time", "Alegeți ora programării.");
    const doctorId = effectiveDoctorId(actor, i.doctorId);
    const startsAt = localToUtc(i.date, i.time);
    const endsAt = localToUtc(i.date, i.time + (i.durationMinutes ?? 30));
    assertValidInterval(startsAt, endsAt);
    newAppt = { locationId: i.locationId, doctorId, serviceId: i.serviceId ?? lead.serviceId ?? null, startsAt, endsAt };
  }
  const gdpr = await getSettings("gdpr");

  return withSchedulingTx(async (tx) => {
    // Re-read inside the transaction: a concurrent conversion loses.
    const fresh = await tx.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { convertedAt: true, patientId: true } });
    if (fresh.convertedAt && fresh.patientId) throw new DomainError("CONFLICT", "Cererea a fost deja convertită în pacient.");

    let patientId: string;
    let created = false;
    if (i.mode === "existent") {
      const p = await tx.patient.findUnique({ where: { id: i.patientId! }, select: { id: true, anonymizedAt: true } });
      if (!p || p.anonymizedAt) fieldError("patientId", "Pacientul ales nu mai există.");
      patientId = p.id;
    } else {
      const patient = await createPatient(
        tx,
        {
          firstName: i.firstName!,
          lastName: i.lastName!,
          phone: i.phone ?? null,
          email: i.email ?? null,
          birthDate: i.birthDate ?? null,
          preferredLocationId: lead.locationId ?? newAppt?.locationId ?? null,
          comfortDefault: lead.comfort,
          prefersSedation: lead.wantsSedation,
          smsOptIn: lead.consentSms,
          emailOptIn: false,
          acquisitionSource: lead.source,
        },
        actor,
      );
      patientId = patient.id;
      created = true;
    }

    // 2. Consent evidence.
    const consents = leadConsentRows(lead, patientId, actor.id, gdpr.consentTextVersion);
    if (consents.length > 0) await tx.consent.createMany({ data: consents });
    if (lead.consentSms) await tx.patient.update({ where: { id: patientId }, data: { smsOptIn: true } });

    // 3. Appointment.
    let appointmentId: string;
    if (newAppt) {
      const conflicts = await findConflicts(tx, { ...newAppt, patientId, wantsSedation: lead.wantsSedation }, { now });
      assertConflictsAllowed(conflicts, { acknowledgeWarnings: i.acknowledgeWarnings, user: actor, doctorId: newAppt.doctorId });
      const appt = await tx.appointment.create({
        data: {
          ...newAppt,
          patientId,
          leadId: lead.id,
          status: "PROGRAMAT",
          source: lead.source === "PROGRAMARE_ONLINE" ? "ONLINE" : "TELEFON",
          comfort: lead.comfort,
          comfortNote: lead.comfortNote,
          wantsSedation: lead.wantsSedation,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      appointmentId = appt.id;
      await audit({ action: "appointment.create", entityType: "Appointment", entityId: appt.id, patientId, metadata: { source: appt.source, from: "lead" } }, { actor, db: tx });
    } else {
      await tx.appointment.updateMany({ where: { leadId: lead.id, patientId: null }, data: { patientId, updatedById: actor.id } });
      appointmentId = tentative[0].id;
    }

    // 4. Lead.
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "PROGRAMAT", convertedAt: now, patientId, contactedAt: lead.contactedAt ?? now, lostReason: null },
    });
    const fileNumber = (await tx.patient.findUniqueOrThrow({ where: { id: patientId }, select: { fileNumber: true } })).fileNumber;
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "CONVERSIE",
        body: `${created ? "Pacient nou" : "Pacient existent"}, fișa nr. ${fileNumber}.${newAppt ? " Programare creată." : " Programarea online a fost legată de fișă."}`,
        authorId: actor.id,
      },
    });
    // 5. Audit.
    await audit(
      {
        action: "lead.convert",
        entityType: "Lead",
        entityId: lead.id,
        patientId,
        metadata: { mode: i.mode, consents: consents.map((c) => c.type), appointment: newAppt ? "noua" : "existenta" },
      },
      { actor, db: tx },
    );
    return { patientId, appointmentId, createdPatient: created };
  });
}
