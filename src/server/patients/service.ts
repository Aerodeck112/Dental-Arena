import "server-only";
import type { Patient } from "@/generated/prisma/client";
import type { Sex } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma, type Db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { ageFromBirthDate, personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { buildPatientSearchText, decryptPii, encryptPii, hmacHash } from "@/lib/pii";
import { searchTokens } from "@/lib/search";
import { nextSequence, SEQUENCE_KEYS } from "@/lib/sequences";
import { isValidDateISO, localToUtc } from "@/lib/time";
import { isValidCnp } from "@/lib/validation/common";
import { localDateOrNull, PATIENT_SUMMARY_SELECT, toPatientSummary } from "./summary";
import type {
  PatientAppointmentDTO,
  PatientCreateInput,
  PatientHeaderDTO,
  PatientListResult,
  PatientPersonalDTO,
  PatientSummary,
  PatientUpdateInput,
} from "./types";

/**
 * The patient record (docs/architecture.md §3.2 invariants 5–7, §7.3, §8.4–§8.5; WP7).
 * Framework-free: no `next/*` imports, so everything here is unit-testable.
 */

export const PATIENT_PAGE_SIZE = 25;

function hasTransaction(db: Db): db is typeof prisma {
  return typeof (db as { $transaction?: unknown }).$transaction === "function";
}

/** Runs `fn` in the caller's transaction, or opens one when `db` is the root client. */
export async function inTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return hasTransaction(db) ? db.$transaction(fn) : fn(db);
}

/** Birth date and sex encoded in a valid CNP: S YY MM DD … */
export function cnpBirthInfo(cnp: string): { birthDate: string; sex: Sex } | null {
  if (!isValidCnp(cnp)) return null;
  const s = Number(cnp[0]);
  const century = s === 1 || s === 2 ? 1900 : s === 3 || s === 4 ? 1800 : s === 5 || s === 6 ? 2000 : null;
  const yy = Number(cnp.slice(1, 3));
  const iso = (c: number) => `${c + yy}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`;
  // 7/8 (residents) and 9 (foreigners) carry no century: take the one that is not in the future.
  let birthDate = century !== null ? iso(century) : iso(2000);
  if (century === null && birthDate > new Date().toISOString().slice(0, 10)) birthDate = iso(1900);
  if (!isValidDateISO(birthDate)) return null;
  const sex: Sex = s % 2 === 1 ? "M" : "F";
  return { birthDate, sex };
}

async function assertCnpFree(db: Db, cnpHash: string, exceptId?: string) {
  const other = await db.patient.findUnique({ where: { cnpHash }, select: { id: true, fileNumber: true } });
  if (other && other.id !== exceptId) {
    throw new DomainError("CONFLICT", `Acest CNP aparține deja fișei nr. ${other.fileNumber}.`, {
      fieldErrors: { cnp: [`Acest CNP aparține deja fișei nr. ${other.fileNumber}.`] },
    });
  }
}

async function assertGuardian(db: Db, guardianId: string | null | undefined, selfId?: string) {
  if (!guardianId) return;
  if (guardianId === selfId) {
    throw new DomainError("VALIDATION", "Pacientul nu poate fi propriul aparținător.", {
      fieldErrors: { guardianId: ["Pacientul nu poate fi propriul aparținător."] },
    });
  }
  const g = await db.patient.findUnique({ where: { id: guardianId }, select: { id: true, anonymizedAt: true } });
  if (!g || g.anonymizedAt) {
    throw new DomainError("VALIDATION", "Alegeți un aparținător existent.", {
      fieldErrors: { guardianId: ["Alegeți un aparținător existent."] },
    });
  }
}

/**
 * §7.3 contract. Creates a patient: assigns the file number from the „PACIENT” sequence in the
 * same transaction, builds `searchText`, encrypts and hashes the CNP, and audits `patient.create`.
 * Pass a transaction client to join the caller's transaction (lead conversion).
 */
export async function createPatient(db: Db, i: PatientCreateInput & { prefersSedation?: boolean; notes?: string | null }, actor: CurrentUser): Promise<Patient> {
  const firstName = i.firstName.trim();
  const lastName = i.lastName.trim();
  if (!firstName || !lastName) {
    throw new DomainError("VALIDATION", "Completați numele și prenumele.", {
      fieldErrors: {
        ...(firstName ? {} : { firstName: ["Completați prenumele."] }),
        ...(lastName ? {} : { lastName: ["Completați numele."] }),
      },
    });
  }
  const cnp = i.cnp ? i.cnp.replace(/\s/g, "") : null;
  if (cnp && !isValidCnp(cnp)) {
    throw new DomainError("VALIDATION", "CNP-ul nu este valid.", { fieldErrors: { cnp: ["CNP-ul nu este valid."] } });
  }
  const fromCnp = cnp ? cnpBirthInfo(cnp) : null;
  const birthISO = i.birthDate ?? fromCnp?.birthDate ?? null;
  if (birthISO && !isValidDateISO(birthISO)) {
    throw new DomainError("VALIDATION", "Introduceți o dată validă.", { fieldErrors: { birthDate: ["Introduceți o dată validă."] } });
  }

  return inTx(db, async (tx) => {
    const cnpHash = cnp ? hmacHash(cnp, "cnp") : null;
    if (cnpHash) await assertCnpFree(tx, cnpHash);
    await assertGuardian(tx, i.guardianId);
    const fileNumber = await nextSequence(tx, SEQUENCE_KEYS.patient);
    const email = i.email ? i.email.trim().toLowerCase() : null;
    const patient = await tx.patient.create({
      data: {
        fileNumber,
        firstName,
        lastName,
        searchText: buildPatientSearchText({ firstName, lastName, phone: i.phone, email }),
        cnpEncrypted: cnp ? encryptPii(cnp) : null,
        cnpHash,
        birthDate: birthISO ? localToUtc(birthISO, 0) : null,
        sex: i.sex ?? fromCnp?.sex ?? null,
        phone: i.phone ?? null,
        email,
        guardianId: i.guardianId ?? null,
        preferredLocationId: i.preferredLocationId ?? actor.homeLocationId ?? null,
        primaryDoctorId: i.primaryDoctorId ?? null,
        comfortDefault: i.comfortDefault ?? null,
        prefersSedation: i.prefersSedation ?? false,
        smsOptIn: i.smsOptIn ?? false,
        emailOptIn: i.emailOptIn ?? false,
        acquisitionSource: i.acquisitionSource ?? null,
        notes: i.notes ?? null,
        createdById: actor.id,
      },
    });
    const fields = Object.entries(i)
      .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== "")
      .map(([k]) => k);
    await audit(
      { action: "patient.create", entityType: "Patient", entityId: patient.id, patientId: patient.id, metadata: { fields } },
      { actor, db: tx },
    );
    return patient;
  });
}

/** §7.3 contract. */
export async function getPatientSummary(id: string): Promise<PatientSummary | null> {
  const row = await prisma.patient.findUnique({ where: { id }, select: PATIENT_SUMMARY_SELECT });
  return row ? toPatientSummary(row) : null;
}

/** Throws NOT_FOUND, or CONFLICT for an anonymised file (it can no longer be edited). */
export async function assertPatientEditable(db: Db, id: string): Promise<{ id: string; fileNumber: number }> {
  const p = await db.patient.findUnique({ where: { id }, select: { id: true, fileNumber: true, anonymizedAt: true } });
  if (!p) throw new DomainError("NOT_FOUND", "Pacientul nu a fost găsit.");
  if (p.anonymizedAt) throw new DomainError("CONFLICT", "Fișa a fost anonimizată și nu mai poate fi modificată.");
  return p;
}

const UPDATABLE_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "birthDate",
  "sex",
  "guardianId",
  "preferredLocationId",
  "primaryDoctorId",
  "comfortDefault",
  "prefersSedation",
  "smsOptIn",
  "emailOptIn",
  "acquisitionSource",
  "street",
  "city",
  "county",
  "notes",
] as const;

export async function updatePatient(
  actor: CurrentUser,
  id: string,
  i: PatientUpdateInput & { cnpAction?: "keep" | "set" | "clear"; expectedUpdatedAt?: string },
): Promise<{ id: string; changed: string[] }> {
  return prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, id);
    const before = await tx.patient.findUniqueOrThrow({ where: { id } });
    if (i.expectedUpdatedAt && before.updatedAt.toISOString() !== i.expectedUpdatedAt) {
      throw new DomainError("STALE", "Fișa a fost modificată între timp. Reîncărcați pagina.");
    }
    await assertGuardian(tx, i.guardianId, id);
    const email = i.email ? i.email.trim().toLowerCase() : null;
    const next = {
      firstName: i.firstName.trim(),
      lastName: i.lastName.trim(),
      phone: i.phone ?? null,
      email,
      birthDate: i.birthDate ? localToUtc(i.birthDate, 0) : null,
      sex: i.sex ?? null,
      guardianId: i.guardianId ?? null,
      preferredLocationId: i.preferredLocationId ?? null,
      primaryDoctorId: i.primaryDoctorId ?? null,
      comfortDefault: i.comfortDefault ?? null,
      prefersSedation: i.prefersSedation ?? false,
      smsOptIn: i.smsOptIn ?? false,
      emailOptIn: i.emailOptIn ?? false,
      acquisitionSource: i.acquisitionSource ?? null,
      street: i.street ?? null,
      city: i.city ?? null,
      county: i.county ?? null,
      notes: i.notes ?? null,
    };
    const changed: string[] = UPDATABLE_FIELDS.filter((k) => {
      const a = before[k];
      const b = next[k];
      if (a instanceof Date || b instanceof Date) return (a as Date | null)?.getTime() !== (b as Date | null)?.getTime();
      return (a ?? null) !== (b ?? null);
    });

    let cnpData: { cnpEncrypted: string | null; cnpHash: string | null } | null = null;
    if (i.cnpAction === "set" && i.cnp) {
      const cnp = i.cnp.replace(/\s/g, "");
      if (!isValidCnp(cnp)) {
        throw new DomainError("VALIDATION", "CNP-ul nu este valid.", { fieldErrors: { cnp: ["CNP-ul nu este valid."] } });
      }
      const cnpHash = hmacHash(cnp, "cnp");
      await assertCnpFree(tx, cnpHash, id);
      if (cnpHash !== before.cnpHash) {
        cnpData = { cnpEncrypted: encryptPii(cnp), cnpHash };
        changed.push("cnp");
      }
    } else if (i.cnpAction === "clear" && before.cnpHash) {
      cnpData = { cnpEncrypted: null, cnpHash: null };
      changed.push("cnp");
    }

    if (changed.length === 0) return { id, changed };
    await tx.patient.update({
      where: { id },
      data: {
        ...next,
        ...(cnpData ?? {}),
        searchText: buildPatientSearchText({ firstName: next.firstName, lastName: next.lastName, phone: next.phone, email }),
      },
    });
    await audit(
      { action: "patient.update", entityType: "Patient", entityId: id, patientId: id, metadata: { fields: changed } },
      { actor, db: tx },
    );
    return { id, changed };
  });
}

/** Comfort answer and sedation preference only (the mustard panel on the header). */
export async function updatePatientComfort(
  actor: CurrentUser,
  id: string,
  i: { comfortDefault?: PatientCreateInput["comfortDefault"]; prefersSedation: boolean },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, id);
    await tx.patient.update({
      where: { id },
      data: { comfortDefault: i.comfortDefault ?? null, prefersSedation: i.prefersSedation },
    });
    await audit(
      {
        action: "patient.update",
        entityType: "Patient",
        entityId: id,
        patientId: id,
        metadata: { fields: ["comfortDefault", "prefersSedation"] },
      },
      { actor, db: tx },
    );
  });
}

// ───────────────────────────── List and search ─────────────────────────────

export type PatientListQuery = { q?: string; tagId?: string | null; page?: number; pageSize?: number; now?: Date };

/** Pure: the `where` of the patient search (name with or without diacritics, phone in any format, e-mail, file number). */
export function patientSearchWhere(q: string | undefined, tagId?: string | null) {
  const and: object[] = [];
  const raw = (q ?? "").trim();
  if (raw) {
    const fileMatch = /^(?:nr\.?\s*|fi[sș]a\s*|#)?(\d{1,7})$/i.exec(raw);
    const tokens = searchTokens(raw);
    const textCond = tokens.length > 0 ? { AND: tokens.map((t) => ({ searchText: { contains: t } })) } : null;
    if (fileMatch) {
      const n = Number(fileMatch[1]);
      const or: object[] = [{ fileNumber: n }];
      if (textCond && fileMatch[1].length >= 3) or.push(textCond);
      and.push({ OR: or });
    } else if (textCond) {
      and.push(textCond);
    }
  }
  if (tagId) and.push({ tags: { some: { tagId } } });
  return and.length > 0 ? { AND: and } : {};
}

export async function listPatients(f: PatientListQuery): Promise<PatientListResult> {
  const pageSize = f.pageSize ?? PATIENT_PAGE_SIZE;
  const where = patientSearchWhere(f.q, f.tagId);
  const total = await prisma.patient.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(f.page ?? 1)), pageCount);
  const rows = await prisma.patient.findMany({
    where,
    orderBy: [{ anonymizedAt: "asc" }, { lastName: "asc" }, { firstName: "asc" }, { fileNumber: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      ...PATIENT_SUMMARY_SELECT,
      preferredLocation: { select: { shortName: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
    },
  });
  const ids = rows.map((r) => r.id);
  const now = f.now ?? new Date();
  const [past, future] = ids.length
    ? await Promise.all([
        prisma.appointment.groupBy({
          by: ["patientId"],
          where: { patientId: { in: ids }, status: "FINALIZAT", startsAt: { lt: now } },
          _max: { startsAt: true },
        }),
        prisma.appointment.groupBy({
          by: ["patientId"],
          where: { patientId: { in: ids }, status: { in: ["PROGRAMAT", "CONFIRMAT"] }, startsAt: { gte: now } },
          _min: { startsAt: true },
        }),
      ])
    : [[], []];
  const lastMap = new Map(past.map((g) => [g.patientId, g._max.startsAt]));
  const nextMap = new Map(future.map((g) => [g.patientId, g._min.startsAt]));
  return {
    rows: rows.map((r) => ({
      ...toPatientSummary(r),
      age: r.birthDate ? ageFromBirthDate(r.birthDate, now) : null,
      locationName: r.preferredLocation?.shortName ?? null,
      tags: r.tags.map((t) => t.tag).sort((a, b) => a.name.localeCompare(b.name, "ro")),
      lastVisit: lastMap.get(r.id)?.toISOString() ?? null,
      nextVisit: nextMap.get(r.id)?.toISOString() ?? null,
    })),
    total,
    page,
    pageSize,
    pageCount,
  };
}

/** Small picker search (guardian field, quick lookups). Excludes anonymised files. */
export async function searchPatientSummaries(q: string, take = 8, excludeId?: string): Promise<PatientSummary[]> {
  if (q.trim().length < 2) return [];
  const rows = await prisma.patient.findMany({
    where: { ...patientSearchWhere(q), anonymizedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select: PATIENT_SUMMARY_SELECT,
  });
  return rows.map(toPatientSummary);
}

// ───────────────────────────── Patient file ─────────────────────────────

const HEADER_SELECT = {
  id: true,
  fileNumber: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  sex: true,
  phone: true,
  email: true,
  comfortDefault: true,
  prefersSedation: true,
  smsOptIn: true,
  emailOptIn: true,
  anonymizedAt: true,
  active: true,
  cnpHash: true,
  preferredLocation: { select: { id: true, shortName: true } },
  primaryDoctor: { select: { id: true, publicName: true } },
  guardian: { select: { id: true, firstName: true, lastName: true } },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
} as const;

type HeaderRow = {
  id: string;
  fileNumber: number;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  sex: Sex | null;
  phone: string | null;
  email: string | null;
  comfortDefault: PatientHeaderDTO["comfortDefault"];
  prefersSedation: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean;
  anonymizedAt: Date | null;
  active: boolean;
  cnpHash: string | null;
  preferredLocation: { id: string; shortName: string } | null;
  primaryDoctor: { id: string; publicName: string } | null;
  guardian: { id: string; firstName: string; lastName: string } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

function toHeader(r: HeaderRow, cnpLast2: string | null, comfortNote: string | null, now: Date): PatientHeaderDTO {
  return {
    id: r.id,
    fileNumber: r.fileNumber,
    firstName: r.firstName,
    lastName: r.lastName,
    name: personName(r),
    age: r.birthDate ? ageFromBirthDate(r.birthDate, now) : null,
    birthDate: localDateOrNull(r.birthDate),
    sex: r.sex,
    phone: r.phone,
    email: r.email,
    preferredLocation: r.preferredLocation ? { id: r.preferredLocation.id, name: r.preferredLocation.shortName } : null,
    primaryDoctor: r.primaryDoctor ? { id: r.primaryDoctor.id, name: r.primaryDoctor.publicName } : null,
    comfortDefault: r.comfortDefault,
    prefersSedation: r.prefersSedation,
    comfortNote,
    smsOptIn: r.smsOptIn,
    emailOptIn: r.emailOptIn,
    anonymized: r.anonymizedAt !== null,
    active: r.active,
    hasCnp: r.cnpHash !== null,
    cnpLast2,
    guardian: r.guardian ? { id: r.guardian.id, name: personName(r.guardian) } : null,
    tags: r.tags.map((t) => t.tag).sort((a, b) => a.name.localeCompare(b.name, "ro")),
  };
}

/** The last two CNP digits for the mask „1••••••••••23”. Decrypting for the mask is not a reveal. */
async function cnpLast2(id: string): Promise<string | null> {
  const row = await prisma.patient.findUnique({ where: { id }, select: { cnpEncrypted: true } });
  if (!row?.cnpEncrypted) return null;
  try {
    return decryptPii(row.cnpEncrypted).slice(-2);
  } catch {
    return null;
  }
}

export async function getPatientHeader(id: string, now: Date = new Date()): Promise<PatientHeaderDTO | null> {
  const r = await prisma.patient.findUnique({ where: { id }, select: HEADER_SELECT });
  if (!r) return null;
  const [last2, comfortAppt] = await Promise.all([
    r.cnpHash ? cnpLast2(id) : Promise.resolve(null),
    prisma.appointment.findFirst({
      where: { patientId: id, comfortNote: { not: null } },
      orderBy: { startsAt: "desc" },
      select: { comfortNote: true },
    }),
  ]);
  return toHeader(r, last2, comfortAppt?.comfortNote?.trim() || null, now);
}

export async function getPatientPersonal(id: string, now: Date = new Date()): Promise<PatientPersonalDTO | null> {
  const r = await prisma.patient.findUnique({
    where: { id },
    select: {
      ...HEADER_SELECT,
      street: true,
      city: true,
      county: true,
      notes: true,
      acquisitionSource: true,
      createdAt: true,
      dependents: { select: { id: true, firstName: true, lastName: true, birthDate: true }, orderBy: { birthDate: "desc" } },
    },
  });
  if (!r) return null;
  const header = await getPatientHeader(id, now);
  if (!header) return null;
  return {
    ...header,
    street: r.street,
    city: r.city,
    county: r.county,
    notes: r.notes,
    acquisitionSource: r.acquisitionSource,
    createdAt: r.createdAt.toISOString(),
    dependents: r.dependents.map((d) => ({
      id: d.id,
      name: personName(d),
      age: d.birthDate ? ageFromBirthDate(d.birthDate, now) : null,
    })),
  };
}

/** Reveals the clear CNP. Always audited as `patient.cnp.reveal`. */
export async function revealCnp(actor: CurrentUser, id: string): Promise<string> {
  if (!can(actor, "patients.revealCnp")) throw new DomainError("FORBIDDEN", "Nu aveți dreptul să vedeți CNP-ul.");
  const row = await prisma.patient.findUnique({ where: { id }, select: { cnpEncrypted: true } });
  if (!row) throw new DomainError("NOT_FOUND", "Pacientul nu a fost găsit.");
  if (!row.cnpEncrypted) throw new DomainError("NOT_FOUND", "Fișa nu are CNP.");
  const cnp = decryptPii(row.cnpEncrypted);
  await audit({ action: "patient.cnp.reveal", entityType: "Patient", entityId: id, patientId: id }, { actor });
  return cnp;
}

/** Writes `patient.view` at most once per user, patient and hour (§8.4). Returns true when it wrote. */
export async function recordPatientView(actor: CurrentUser, patientId: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const recent = await prisma.auditLog.findFirst({
    where: { action: "patient.view", actorId: actor.id, patientId, at: { gte: since } },
    select: { id: true },
  });
  if (recent) return false;
  await audit({ action: "patient.view", entityType: "Patient", entityId: patientId, patientId }, { actor });
  return true;
}

export async function getPatientAppointments(patientId: string): Promise<PatientAppointmentDTO[]> {
  const rows = await prisma.appointment.findMany({
    where: { patientId },
    orderBy: { startsAt: "desc" },
    take: 500,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      reason: true,
      cancelReason: true,
      location: { select: { shortName: true } },
      doctor: { select: { publicName: true } },
      service: { select: { name: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    locationName: a.location.shortName,
    doctorName: a.doctor.publicName,
    serviceName: a.service?.name ?? null,
    reason: a.reason,
    cancelReason: a.cancelReason,
  }));
}

/** The next booked visit, for the „Prezentare” tab. */
export async function getNextAppointment(patientId: string, now: Date = new Date()): Promise<PatientAppointmentDTO | null> {
  const a = await prisma.appointment.findFirst({
    where: { patientId, startsAt: { gte: now }, status: { in: ["PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT"] } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      reason: true,
      cancelReason: true,
      location: { select: { shortName: true } },
      doctor: { select: { publicName: true } },
      service: { select: { name: true } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    locationName: a.location.shortName,
    doctorName: a.doctor.publicName,
    serviceName: a.service?.name ?? null,
    reason: a.reason,
    cancelReason: a.cancelReason,
  };
}

/** Options for the patient forms. */
export async function getPatientFormOptions(): Promise<{
  locations: { id: string; name: string }[];
  doctors: { id: string; name: string }[];
}> {
  const [locations, doctors] = await Promise.all([
    prisma.location.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, shortName: true } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, publicName: true } }),
  ]);
  return {
    locations: locations.map((l) => ({ id: l.id, name: l.shortName })),
    doctors: doctors.map((d) => ({ id: d.id, name: d.publicName })),
  };
}
