import "server-only";
import type { DataRequestStatus, DataRequestType, Role } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { decryptPii } from "@/lib/pii";
import { localToUtc, todayISO, utcToLocal, diffDaysISO } from "@/lib/time";
import { storage as defaultStorage, type FileStorage } from "./storage";
import type { AuditEntryDTO, DataRequestDTO } from "./types";

/**
 * Data-subject rights (docs/architecture.md §3.2 invariant 11, §8.4 „Data subject rights”):
 * the JSON export, anonymisation (erasure) and the register of requests. ADMIN only (`gdpr.manage`).
 */

function assertGdpr(user: CurrentUser) {
  if (!can(user, "gdpr.manage")) throw new DomainError("FORBIDDEN", "Doar administratorii gestionează cererile GDPR.");
}

export const REDACTED = "[anonimizat]";
export const DATA_REQUEST_DAYS = 30;

// ───────────────────────────── Anonymisation ─────────────────────────────

/**
 * Pure: the identity fields of an anonymised patient (invariant 11). The name becomes
 * „Pacient anonimizat #<fileNumber>”; CNP, phone, e-mail and address are nulled; `searchText`
 * keeps only the anonymous name, so the file stays findable by its number and nothing else.
 * Clinical fields (birth date, sex, anamneză, odontogram, plans) are not touched here.
 */
export function anonymizedPatientData(fileNumber: number, now: Date) {
  return {
    firstName: "Pacient",
    lastName: `anonimizat #${fileNumber}`,
    searchText: `pacient anonimizat ${fileNumber}`,
    cnpEncrypted: null,
    cnpHash: null,
    phone: null,
    email: null,
    street: null,
    city: null,
    county: null,
    notes: null,
    guardianId: null,
    smsOptIn: false,
    emailOptIn: false,
    active: false,
    anonymizedAt: now,
  } as const;
}

/** Pure: the lead fields that are redacted for an anonymised patient. */
export const ANONYMIZED_LEAD_DATA = {
  name: "Cerere anonimizată",
  phone: null,
  email: null,
  message: null,
  comfortNote: null,
  childFirstName: null,
  preferredTime: null,
  ipHash: null,
} as const;

/** Pure: the message-log fields that are redacted (the row stays for the delivery statistics). */
export const ANONYMIZED_MESSAGE_DATA = { to: REDACTED, subject: null, body: REDACTED } as const;

/**
 * Erasure (`patient.anonymize`). One transaction; requires the typed file number. Leads, the
 * administrative notes, the patient's own words on appointments and the message log are
 * redacted; documents are soft-deleted and their files removed from storage after the commit.
 * Clinical (anamneză, odontogram, clinical notes, plans) and financial records are kept.
 */
export async function anonymizePatient(
  actor: CurrentUser,
  patientId: string,
  confirmFileNumber: number,
  o: { now?: Date; store?: FileStorage } = {},
): Promise<{ fileNumber: number; documentsRemoved: number }> {
  assertGdpr(actor);
  const now = o.now ?? new Date();
  const store = o.store ?? defaultStorage;
  const result = await prisma.$transaction(async (tx) => {
    const p = await tx.patient.findUnique({ where: { id: patientId }, select: { id: true, fileNumber: true, anonymizedAt: true } });
    if (!p) throw new DomainError("NOT_FOUND", "Pacientul nu a fost găsit.");
    if (p.anonymizedAt) throw new DomainError("CONFLICT", "Fișa este deja anonimizată.");
    if (confirmFileNumber !== p.fileNumber) {
      throw new DomainError("VALIDATION", "Numărul fișei nu corespunde.", {
        fieldErrors: { confirmFileNumber: [`Tastați numărul fișei, ${p.fileNumber}, pentru confirmare.`] },
      });
    }
    await tx.patient.update({ where: { id: p.id }, data: anonymizedPatientData(p.fileNumber, now) });
    await tx.patientTag.deleteMany({ where: { patientId } });

    const leads = await tx.lead.findMany({ where: { patientId }, select: { id: true } });
    if (leads.length) {
      const ids = leads.map((l) => l.id);
      await tx.lead.updateMany({ where: { id: { in: ids } }, data: ANONYMIZED_LEAD_DATA });
      await tx.leadActivity.updateMany({ where: { leadId: { in: ids } }, data: { body: null } });
    }
    await tx.patientNote.updateMany({ where: { patientId, clinical: false }, data: { body: REDACTED } });
    await tx.appointment.updateMany({ where: { patientId }, data: { comfortNote: null, notes: null } });
    await tx.messageLog.updateMany({ where: { patientId }, data: ANONYMIZED_MESSAGE_DATA });

    const docs = await tx.patientDocument.findMany({ where: { patientId }, select: { id: true, storageKey: true, deletedAt: true } });
    await tx.patientDocument.updateMany({ where: { patientId, deletedAt: null }, data: { deletedAt: now } });

    await audit(
      {
        action: "patient.anonymize",
        entityType: "Patient",
        entityId: patientId,
        patientId,
        metadata: { leads: leads.length, documents: docs.length },
      },
      { actor, db: tx },
    );
    return { fileNumber: p.fileNumber, keys: docs.map((d) => d.storageKey) };
  });
  let removed = 0;
  for (const key of result.keys) {
    try {
      await store.remove(key);
      removed += 1;
    } catch {
      console.error("[gdpr] could not remove a document file during anonymisation");
    }
  }
  return { fileNumber: result.fileNumber, documentsRemoved: removed };
}

// ───────────────────────────── Export ─────────────────────────────

const omitKeys = <T extends Record<string, unknown>>(o: T, keys: string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

/**
 * The JSON export (`patient.export`): patient fields with the CNP decrypted, anamneză, consents,
 * tooth conditions, plans and items, appointments, invoices and payments, notes, document
 * metadata (files are listed, not embedded), message log and the audit trail for the patient.
 */
export async function exportPatientData(actor: CurrentUser, patientId: string, now: Date = new Date()): Promise<{ fileName: string; data: Record<string, unknown> }> {
  assertGdpr(actor);
  const p = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      preferredLocation: { select: { shortName: true } },
      primaryDoctor: { select: { publicName: true } },
      guardian: { select: { fileNumber: true, firstName: true, lastName: true } },
      tags: { select: { tag: { select: { name: true } } } },
      medicalHistory: true,
      consents: true,
      toothConditions: { orderBy: [{ tooth: "asc" }, { recordedAt: "asc" }] },
      treatmentPlans: { include: { items: { orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] } }, orderBy: { createdAt: "asc" } },
      appointments: {
        orderBy: { startsAt: "asc" },
        include: { location: { select: { shortName: true } }, doctor: { select: { publicName: true } }, service: { select: { name: true } } },
      },
      invoices: { include: { items: true }, orderBy: { issuedAt: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
      patientNotes: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      leads: { include: { activities: true } },
      dataRequests: true,
    },
  });
  if (!p) throw new DomainError("NOT_FOUND", "Pacientul nu a fost găsit.");
  const [messages, auditTrail] = await Promise.all([
    prisma.messageLog.findMany({ where: { patientId }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ where: { patientId }, orderBy: { at: "asc" }, select: { at: true, action: true, actorName: true, actorRole: true, entityType: true, metadata: true } }),
  ]);
  let cnp: string | null = null;
  if (p.cnpEncrypted) {
    try {
      cnp = decryptPii(p.cnpEncrypted);
    } catch {
      cnp = null;
    }
  }
  const {
    medicalHistory,
    consents,
    toothConditions,
    treatmentPlans,
    appointments,
    invoices,
    payments,
    patientNotes,
    documents,
    leads,
    dataRequests,
    preferredLocation,
    primaryDoctor,
    guardian,
    tags,
    ...fields
  } = p;
  const data = {
    format: "dental-arena-export-v1",
    generatedAt: now.toISOString(),
    patient: {
      ...omitKeys(fields, ["cnpEncrypted", "cnpHash", "searchText"]),
      cnp,
      preferredLocation: preferredLocation?.shortName ?? null,
      primaryDoctor: primaryDoctor?.publicName ?? null,
      guardian: guardian ? { fileNumber: guardian.fileNumber, name: personName(guardian) } : null,
      tags: tags.map((t) => t.tag.name),
    },
    medicalHistory,
    consents: consents.map((c) => omitKeys(c, ["ipHash"])),
    toothConditions,
    treatmentPlans,
    appointments: appointments.map((a) => ({
      ...omitKeys(a, ["tokenVersion"]),
      location: a.location.shortName,
      doctor: a.doctor.publicName,
      service: a.service?.name ?? null,
    })),
    invoices,
    payments,
    notes: patientNotes,
    documents: documents.map((d) => omitKeys(d, ["storageKey"])),
    leads: leads.map((l) => omitKeys(l, ["ipHash", "idempotencyKey"])),
    dataRequests,
    messages,
    auditTrail,
  };
  await audit({ action: "patient.export", entityType: "Patient", entityId: patientId, patientId }, { actor });
  return { fileName: `pacient-${p.fileNumber}-export-${todayISO(now)}.json`, data };
}

// ───────────────────────────── Audit trail ─────────────────────────────

export async function getPatientAuditTrail(actor: CurrentUser, patientId: string, take = 200): Promise<AuditEntryDTO[]> {
  assertGdpr(actor);
  const rows = await prisma.auditLog.findMany({
    where: { patientId },
    orderBy: { at: "desc" },
    take,
    select: { id: true, at: true, action: true, actorName: true, actorRole: true, entityType: true },
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    action: r.action,
    actorName: r.actorName,
    actorRole: r.actorRole as Role | null,
    entityType: r.entityType,
  }));
}

// ───────────────────────────── Request register ─────────────────────────────

/** Pure: days left until `dueAt` (local calendar days; negative when overdue). */
export function requestDeadline(dueAt: Date, status: DataRequestStatus, now: Date = new Date()): { daysLeft: number; overdue: boolean } {
  const daysLeft = diffDaysISO(todayISO(now), utcToLocal(dueAt).dateISO);
  const open = status === "PRIMITA" || status === "IN_LUCRU";
  return { daysLeft, overdue: open && daysLeft < 0 };
}

export async function listDataRequests(
  actor: CurrentUser,
  f: { patientId?: string; status?: "deschise" | "toate" } = {},
  now: Date = new Date(),
): Promise<DataRequestDTO[]> {
  assertGdpr(actor);
  const rows = await prisma.dataRequest.findMany({
    where: {
      ...(f.patientId ? { patientId: f.patientId } : {}),
      ...(f.status === "deschise" ? { status: { in: ["PRIMITA", "IN_LUCRU"] } } : {}),
    },
    orderBy: [{ dueAt: "asc" }],
    take: 500,
    include: { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } } },
  });
  const handlerIds = [...new Set(rows.map((r) => r.handledById).filter((v): v is string => Boolean(v)))];
  const users = handlerIds.length ? await prisma.user.findMany({ where: { id: { in: handlerIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const names = new Map(users.map((u) => [u.id, personName(u)]));
  const dto = rows.map((r) => {
    const { daysLeft, overdue } = requestDeadline(r.dueAt, r.status, now);
    return {
      id: r.id,
      patient: r.patient ? { id: r.patient.id, name: personName(r.patient), fileNumber: r.patient.fileNumber } : null,
      type: r.type,
      status: r.status,
      requesterName: r.requesterName,
      contact: r.contact,
      details: r.details,
      receivedAt: r.receivedAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      handledBy: r.handledById ? (names.get(r.handledById) ?? null) : null,
      outcome: r.outcome,
      overdue,
      daysLeft,
    };
  });
  // Open requests first (most urgent on top), then the closed ones, newest first.
  const open = dto.filter((d) => d.status === "PRIMITA" || d.status === "IN_LUCRU");
  const closed = dto.filter((d) => !(d.status === "PRIMITA" || d.status === "IN_LUCRU")).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return [...open, ...closed];
}

export async function createDataRequest(
  actor: CurrentUser,
  i: { patientId?: string | null; type: DataRequestType; requesterName: string; contact?: string | null; details?: string | null; receivedAt?: string | null },
  now: Date = new Date(),
): Promise<{ id: string }> {
  assertGdpr(actor);
  const receivedISO = i.receivedAt ?? todayISO(now);
  if (receivedISO > todayISO(now)) {
    throw new DomainError("VALIDATION", "Data primirii nu poate fi în viitor.", { fieldErrors: { receivedAt: ["Data primirii nu poate fi în viitor."] } });
  }
  const receivedAt = i.receivedAt ? localToUtc(i.receivedAt, 12 * 60) : now;
  const dueAt = new Date(receivedAt.getTime() + DATA_REQUEST_DAYS * 24 * 60 * 60 * 1000);
  if (i.patientId) {
    const p = await prisma.patient.findUnique({ where: { id: i.patientId }, select: { id: true } });
    if (!p) throw new DomainError("VALIDATION", "Pacientul nu a fost găsit.", { fieldErrors: { patientId: ["Alegeți un pacient existent."] } });
  }
  return prisma.$transaction(async (tx) => {
    const r = await tx.dataRequest.create({
      data: {
        patientId: i.patientId ?? null,
        type: i.type,
        requesterName: i.requesterName,
        contact: i.contact ?? null,
        details: i.details ?? null,
        receivedAt,
        dueAt,
        handledById: actor.id,
      },
      select: { id: true },
    });
    await audit(
      { action: "gdpr.request", entityType: "DataRequest", entityId: r.id, patientId: i.patientId ?? null, metadata: { type: i.type, status: "PRIMITA" } },
      { actor, db: tx },
    );
    return r;
  });
}

export async function updateDataRequest(
  actor: CurrentUser,
  i: { requestId: string; status: DataRequestStatus; outcome?: string | null },
  now: Date = new Date(),
): Promise<void> {
  assertGdpr(actor);
  await prisma.$transaction(async (tx) => {
    const r = await tx.dataRequest.findUnique({ where: { id: i.requestId }, select: { id: true, status: true, patientId: true, type: true } });
    if (!r) throw new DomainError("NOT_FOUND", "Cererea nu a fost găsită.");
    const closing = i.status === "FINALIZATA" || i.status === "RESPINSA";
    if (closing && !i.outcome) {
      throw new DomainError("VALIDATION", "Descrieți pe scurt ce s-a răspuns.", { fieldErrors: { outcome: ["Descrieți pe scurt ce s-a răspuns."] } });
    }
    await tx.dataRequest.update({
      where: { id: r.id },
      data: { status: i.status, outcome: i.outcome ?? null, handledById: actor.id, completedAt: closing ? now : null },
    });
    await audit(
      { action: "gdpr.request", entityType: "DataRequest", entityId: r.id, patientId: r.patientId, metadata: { type: r.type, from: r.status, to: i.status } },
      { actor, db: tx },
    );
  });
}
