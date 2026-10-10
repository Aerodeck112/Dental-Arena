import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { canManageTimeOff } from "@/lib/permissions";
import { addDaysISO, localToUtc, minutesToHHMM, todayISO, utcToLocal } from "@/lib/time";
import { optionalField, zCheckbox, zDateISO, zId, zOptionalText, zTimeHHMM } from "@/lib/validation/common";
import type { TimeOffKind } from "@/generated/prisma/enums";
import { BLOCKING_STATUSES } from "./rules";

/**
 * Doctor schedules and time off for the CRM (docs/architecture.md §4.2 `/crm/echipa/[id]/program`
 * and `/crm/absente`). Weekly shifts per location with breaks, cabinet, online flag and validity;
 * time off for a doctor and/or a location. Availability reads these tables directly, so every
 * change shows in the free slots at once.
 */

export const WEEKDAY_NAMES = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"] as const;

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? "";
}

function range(start: number, end: number): string {
  return `${minutesToHHMM(start)}–${minutesToHHMM(end)}`;
}

// ───────────────────────────── DTOs ─────────────────────────────

export type ShiftDTO = {
  id: string;
  locationId: string;
  cabinetId: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  onlineBooking: boolean;
  /** Local dates; `validUntil` is the last day the shift applies (inclusive, for display). */
  validFrom: string | null;
  validUntil: string | null;
  breaks: { startMinute: number; endMinute: number; label: string | null }[];
};

export type ScheduleLocationDTO = { id: string; name: string; shortName: string; cabinets: { id: string; name: string }[] };

export type ScheduleEditorData = {
  doctor: { id: string; publicName: string; active: boolean; acceptsOnlineBooking: boolean };
  locations: ScheduleLocationDTO[];
  shifts: ShiftDTO[];
  /** True until an administrator saves this doctor's schedule („program demonstrativ”). */
  isDemo: boolean;
};

export type TimeOffDTO = {
  id: string;
  doctorId: string | null;
  doctorName: string | null;
  locationId: string | null;
  locationName: string | null;
  kind: TimeOffKind;
  startsAtISO: string;
  endsAtISO: string;
  /** Local dates and times for display. */
  startDate: string;
  startMinute: number;
  /** Last local day covered (inclusive). */
  endDate: string;
  endMinute: number;
  allDay: boolean;
  reason: string | null;
  canDelete: boolean;
};

function toLocalDate(d: Date | null): string | null {
  return d ? utcToLocal(d).dateISO : null;
}

export async function getScheduleEditorData(doctorId: string): Promise<ScheduleEditorData | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, publicName: true, active: true, acceptsOnlineBooking: true },
  });
  if (!doctor) return null;
  const [locations, shifts, edited] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        cabinets: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
      },
    }),
    prisma.workShift.findMany({
      where: { doctorId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      include: { breaks: { orderBy: { startMinute: "asc" } } },
    }),
    prisma.auditLog.count({ where: { action: "schedule.update", entityType: "Doctor", entityId: doctorId } }),
  ]);
  return {
    doctor,
    locations,
    shifts: shifts.map((s) => ({
      id: s.id,
      locationId: s.locationId,
      cabinetId: s.cabinetId,
      weekday: s.weekday,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      onlineBooking: s.onlineBooking,
      validFrom: toLocalDate(s.validFrom),
      validUntil: s.validUntil ? addDaysISO(utcToLocal(s.validUntil).dateISO, -1) : null,
      breaks: s.breaks.map((b) => ({ startMinute: b.startMinute, endMinute: b.endMinute, label: b.label })),
    })),
    isDemo: edited === 0 && shifts.length > 0,
  };
}

// ───────────────────────────── Shifts ─────────────────────────────

function gridCheck(v: number) {
  return v % 5 === 0;
}

export const shiftSchema = z
  .object({
    id: optionalField(zId),
    doctorId: zId,
    locationId: zId,
    cabinetId: optionalField(zId),
    weekday: z.coerce.number({ error: "Alegeți ziua." }).int().min(1, { error: "Alegeți ziua." }).max(7, { error: "Alegeți ziua." }),
    start: zTimeHHMM,
    end: zTimeHHMM,
    onlineBooking: zCheckbox,
    validFrom: optionalField(zDateISO),
    /** Last day (inclusive). */
    validUntil: optionalField(zDateISO),
    breakStart: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string())),
    breakEnd: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string())),
  })
  .transform((v, ctx) => {
    const breaks: { startMinute: number; endMinute: number }[] = [];
    const n = Math.max(v.breakStart.length, v.breakEnd.length);
    for (let i = 0; i < n; i++) {
      const s = (v.breakStart[i] ?? "").trim();
      const e = (v.breakEnd[i] ?? "").trim();
      if (!s && !e) continue;
      const sp = zTimeHHMM.safeParse(s);
      const ep = zTimeHHMM.safeParse(e);
      if (!sp.success || !ep.success) {
        ctx.addIssue({ code: "custom", path: ["breaks"], message: "Scrieți pauza ca interval, de exemplu 12:00–12:30." });
        continue;
      }
      breaks.push({ startMinute: sp.data, endMinute: ep.data });
    }
    return { ...v, breaks };
  });

export type ShiftInput = z.output<typeof shiftSchema>;

/** Rules inside one shift. Returns field errors (empty = valid). Pure, exported for tests. */
export function shiftProblems(i: {
  startMinute: number;
  endMinute: number;
  validFrom?: string;
  validUntil?: string;
  breaks: { startMinute: number; endMinute: number }[];
}): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (k: string, m: string) => (errors[k] ??= []).push(m);
  if (!gridCheck(i.startMinute) || !gridCheck(i.endMinute)) add("start", "Alegeți ore din 5 în 5 minute, de exemplu 09:00 sau 09:05.");
  if (i.endMinute <= i.startMinute) add("end", "Ora de sfârșit trebuie să fie după ora de început.");
  if (i.validFrom && i.validUntil && i.validUntil < i.validFrom) add("validUntil", "Data de sfârșit trebuie să fie după data de început.");
  const sorted = [...i.breaks].sort((a, b) => a.startMinute - b.startMinute);
  sorted.forEach((b, idx) => {
    if (b.endMinute <= b.startMinute) add("breaks", `Pauza ${range(b.startMinute, b.endMinute)} trebuie să se termine după ce începe.`);
    else if (b.startMinute < i.startMinute || b.endMinute > i.endMinute) {
      add("breaks", `Pauza ${range(b.startMinute, b.endMinute)} trebuie să fie în interiorul programului.`);
    }
    if (!gridCheck(b.startMinute) || !gridCheck(b.endMinute)) add("breaks", "Alegeți ore din 5 în 5 minute pentru pauze.");
    const next = sorted[idx + 1];
    if (next && next.startMinute < b.endMinute) add("breaks", "Pauzele nu se pot suprapune.");
  });
  return errors;
}

/** Validity windows `[from, until]` (inclusive local dates, null = open) overlap. */
export function validityOverlaps(
  a: { validFrom: string | null; validUntil: string | null },
  b: { validFrom: string | null; validUntil: string | null },
): boolean {
  const aFrom = a.validFrom ?? "0000-01-01";
  const aUntil = a.validUntil ?? "9999-12-31";
  const bFrom = b.validFrom ?? "0000-01-01";
  const bUntil = b.validUntil ?? "9999-12-31";
  return aFrom <= bUntil && bFrom <= aUntil;
}

/**
 * Creates or updates one weekly shift (ADMIN). Rejects a shift that overlaps another shift of the
 * same doctor on the same weekday (at any location; a doctor cannot be in two places) or another
 * doctor's shift in the same cabinet, when the validity windows overlap.
 */
export async function saveShift(i: ShiftInput, actor: CurrentUser): Promise<{ id: string }> {
  const problems = shiftProblems({
    startMinute: i.start,
    endMinute: i.end,
    validFrom: i.validFrom,
    validUntil: i.validUntil,
    breaks: i.breaks,
  });
  if (Object.keys(problems).length > 0) {
    throw new DomainError("VALIDATION", Object.values(problems)[0][0], { fieldErrors: problems });
  }
  const [doctor, location, cabinet, existing] = await Promise.all([
    prisma.doctor.findUnique({ where: { id: i.doctorId }, select: { id: true } }),
    prisma.location.findUnique({ where: { id: i.locationId }, select: { id: true } }),
    i.cabinetId ? prisma.cabinet.findUnique({ where: { id: i.cabinetId }, select: { id: true, locationId: true, name: true } }) : null,
    i.id ? prisma.workShift.findUnique({ where: { id: i.id }, select: { id: true, doctorId: true } }) : null,
  ]);
  if (!doctor || !location) throw new DomainError("NOT_FOUND");
  if (i.id && (!existing || existing.doctorId !== i.doctorId)) throw new DomainError("NOT_FOUND");
  if (i.cabinetId && (!cabinet || cabinet.locationId !== i.locationId)) {
    throw new DomainError("VALIDATION", "Alegeți un cabinet din clinica aleasă.", { fieldErrors: { cabinetId: ["Alegeți un cabinet din clinica aleasă."] } });
  }

  const mine = { validFrom: i.validFrom ?? null, validUntil: i.validUntil ?? null };
  const others = await prisma.workShift.findMany({
    where: {
      weekday: i.weekday,
      ...(i.id ? { id: { not: i.id } } : {}),
      startMinute: { lt: i.end },
      endMinute: { gt: i.start },
      OR: [{ doctorId: i.doctorId }, ...(i.cabinetId ? [{ cabinetId: i.cabinetId }] : [])],
    },
    select: {
      doctorId: true,
      cabinetId: true,
      startMinute: true,
      endMinute: true,
      validFrom: true,
      validUntil: true,
      location: { select: { shortName: true } },
      cabinet: { select: { name: true } },
      doctor: { select: { publicName: true } },
    },
  });
  for (const o of others) {
    const window = { validFrom: toLocalDate(o.validFrom), validUntil: o.validUntil ? addDaysISO(utcToLocal(o.validUntil).dateISO, -1) : null };
    if (!validityOverlaps(mine, window)) continue;
    const when = `${weekdayName(i.weekday)}, ${range(o.startMinute, o.endMinute)}`;
    const message =
      o.doctorId === i.doctorId
        ? `Intervalul se suprapune cu programul de ${when}, la ${o.location.shortName}. Modificați orele sau programul existent.`
        : `${o.cabinet?.name ?? "Cabinetul"} din ${o.location.shortName} este folosit ${when} de ${o.doctor.publicName}. Alegeți alt cabinet sau alt interval.`;
    throw new DomainError("CONFLICT", message, { fieldErrors: { [o.doctorId === i.doctorId ? "start" : "cabinetId"]: [message] } });
  }

  const data = {
    doctorId: i.doctorId,
    locationId: i.locationId,
    cabinetId: i.cabinetId ?? null,
    weekday: i.weekday,
    startMinute: i.start,
    endMinute: i.end,
    onlineBooking: i.onlineBooking,
    validFrom: i.validFrom ? localToUtc(i.validFrom, 0) : null,
    validUntil: i.validUntil ? localToUtc(addDaysISO(i.validUntil, 1), 0) : null,
  };
  return prisma.$transaction(async (tx) => {
    const shift = i.id
      ? await tx.workShift.update({ where: { id: i.id }, data, select: { id: true } })
      : await tx.workShift.create({ data, select: { id: true } });
    await tx.shiftBreak.deleteMany({ where: { shiftId: shift.id } });
    if (i.breaks.length > 0) {
      await tx.shiftBreak.createMany({
        data: i.breaks.map((b) => ({ shiftId: shift.id, startMinute: b.startMinute, endMinute: b.endMinute, label: "Pauză" })),
      });
    }
    await audit(
      {
        action: "schedule.update",
        entityType: "Doctor",
        entityId: i.doctorId,
        metadata: { op: i.id ? "shift.update" : "shift.create", shiftId: shift.id },
      },
      { actor, db: tx },
    );
    return shift;
  });
}

export async function deleteShift(id: string, actor: CurrentUser): Promise<{ doctorId: string }> {
  const shift = await prisma.workShift.findUnique({ where: { id }, select: { id: true, doctorId: true } });
  if (!shift) throw new DomainError("NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.workShift.delete({ where: { id } });
    await audit(
      { action: "schedule.update", entityType: "Doctor", entityId: shift.doctorId, metadata: { op: "shift.delete", shiftId: id } },
      { actor, db: tx },
    );
  });
  return { doctorId: shift.doctorId };
}

/** ADMIN may mark a doctor's schedule as reviewed without changing a shift (removes „program demonstrativ”). */
export async function confirmSchedule(doctorId: string, actor: CurrentUser): Promise<void> {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
  if (!doctor) throw new DomainError("NOT_FOUND");
  await audit({ action: "schedule.update", entityType: "Doctor", entityId: doctorId, metadata: { op: "schedule.confirm" } }, { actor });
}

// ───────────────────────────── Time off ─────────────────────────────

export const TIME_OFF_KINDS = ["CONCEDIU", "FORMARE", "BLOCAJ", "SARBATOARE"] as const;

export const timeOffSchema = z
  .object({
    doctorId: optionalField(zId),
    locationId: optionalField(zId),
    kind: z.enum(TIME_OFF_KINDS, { error: "Alegeți tipul absenței." }),
    startDate: zDateISO,
    /** Last day (inclusive). */
    endDate: zDateISO,
    /** Optional hours for a partial day: absent = from 00:00 / until the end of the day. */
    startTime: optionalField(zTimeHHMM),
    endTime: optionalField(zTimeHHMM),
    reason: zOptionalText(200),
  })
  .superRefine((v, ctx) => {
    if (!v.doctorId && !v.locationId) {
      ctx.addIssue({ code: "custom", path: ["doctorId"], message: "Alegeți medicul sau clinica (pentru o zi în care clinica este închisă)." });
    }
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ultima zi trebuie să fie după prima zi." });
    }
  });

export type TimeOffInput = z.output<typeof timeOffSchema>;

/** Instants of a time-off form: partial days use the hours, whole days run midnight to midnight (DST-safe). */
export function timeOffInterval(i: Pick<TimeOffInput, "startDate" | "endDate" | "startTime" | "endTime">): { startsAt: Date; endsAt: Date } {
  const startsAt = localToUtc(i.startDate, i.startTime ?? 0);
  const endsAt = i.endTime !== undefined ? localToUtc(i.endDate, i.endTime) : localToUtc(addDaysISO(i.endDate, 1), 0);
  return { startsAt, endsAt };
}

/**
 * Adds time off. ADMIN and RECEPTIE for anyone (and location closures); a MEDIC only for
 * themselves (`canManageTimeOff`). Returns how many booked appointments fall inside, so the page
 * can ask reception to move them.
 */
export async function createTimeOff(i: TimeOffInput, actor: CurrentUser): Promise<{ id: string; affectedAppointments: number }> {
  const doctorId = i.doctorId ?? null;
  if (!canManageTimeOff(actor, doctorId) || (!doctorId && actor.role === "MEDIC")) {
    throw new DomainError("FORBIDDEN", "Puteți adăuga absențe doar pentru dumneavoastră.");
  }
  const { startsAt, endsAt } = timeOffInterval(i);
  if (!(startsAt < endsAt)) {
    throw new DomainError("VALIDATION", "Sfârșitul absenței trebuie să fie după început.", { fieldErrors: { endTime: ["Sfârșitul absenței trebuie să fie după început."] } });
  }
  const [doctor, location] = await Promise.all([
    doctorId ? prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } }) : null,
    i.locationId ? prisma.location.findUnique({ where: { id: i.locationId }, select: { id: true } }) : null,
  ]);
  if ((doctorId && !doctor) || (i.locationId && !location)) throw new DomainError("NOT_FOUND");

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.timeOff.create({
      data: { doctorId, locationId: i.locationId ?? null, kind: i.kind, startsAt, endsAt, reason: i.reason ?? null, createdById: actor.id },
      select: { id: true },
    });
    await audit(
      {
        action: "schedule.update",
        entityType: doctorId ? "Doctor" : "Location",
        entityId: doctorId ?? i.locationId ?? null,
        metadata: { op: "timeoff.create", timeOffId: created.id, kind: i.kind },
      },
      { actor, db: tx },
    );
    return created;
  });
  const affectedAppointments = await prisma.appointment.count({
    where: {
      status: { in: [...BLOCKING_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(doctorId
        ? { doctorId, ...(i.locationId ? { locationId: i.locationId } : {}) }
        : { locationId: i.locationId ?? undefined }),
    },
  });
  return { id: row.id, affectedAppointments };
}

export async function deleteTimeOff(id: string, actor: CurrentUser): Promise<void> {
  const row = await prisma.timeOff.findUnique({ where: { id }, select: { id: true, doctorId: true, locationId: true } });
  if (!row) throw new DomainError("NOT_FOUND");
  if (!canManageTimeOff(actor, row.doctorId) || (!row.doctorId && actor.role === "MEDIC")) {
    throw new DomainError("FORBIDDEN", "Puteți șterge doar absențele dumneavoastră.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.timeOff.delete({ where: { id } });
    await audit(
      {
        action: "schedule.update",
        entityType: row.doctorId ? "Doctor" : "Location",
        entityId: row.doctorId ?? row.locationId,
        metadata: { op: "timeoff.delete", timeOffId: id },
      },
      { actor, db: tx },
    );
  });
}

/** Time off that has not ended yet (or ended in the last `pastDays`), soonest first. */
export async function listTimeOff(
  actor: CurrentUser,
  f: { doctorId?: string | null; locationId?: string | null; pastDays?: number; now?: Date } = {},
): Promise<TimeOffDTO[]> {
  const now = f.now ?? new Date();
  const since = localToUtc(addDaysISO(todayISO(now), -(f.pastDays ?? 0)), 0);
  const rows = await prisma.timeOff.findMany({
    where: {
      endsAt: { gt: since },
      ...(f.doctorId ? { doctorId: f.doctorId } : {}),
      ...(f.locationId ? { OR: [{ locationId: f.locationId }, { locationId: null }] } : {}),
    },
    orderBy: [{ startsAt: "asc" }],
    take: 300,
    select: {
      id: true,
      doctorId: true,
      locationId: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      reason: true,
      doctor: { select: { publicName: true } },
      location: { select: { shortName: true } },
    },
  });
  return rows.map((r) => {
    const s = utcToLocal(r.startsAt);
    const e = utcToLocal(r.endsAt);
    const allDay = s.minute === 0 && e.minute === 0;
    return {
      id: r.id,
      doctorId: r.doctorId,
      doctorName: r.doctor?.publicName ?? null,
      locationId: r.locationId,
      locationName: r.location?.shortName ?? null,
      kind: r.kind,
      startsAtISO: r.startsAt.toISOString(),
      endsAtISO: r.endsAt.toISOString(),
      startDate: s.dateISO,
      startMinute: s.minute,
      endDate: allDay ? addDaysISO(e.dateISO, -1) : e.dateISO,
      endMinute: e.minute,
      allDay,
      reason: r.reason,
      canDelete: canManageTimeOff(actor, r.doctorId) && !(r.doctorId === null && actor.role === "MEDIC"),
    };
  });
}
