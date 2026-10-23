import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { scopeLocationIds, type ClinicScope } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { capitalize, formatDateRo, formatYears, personName } from "@/lib/format";
import { CLINIC_SCOPE_LABEL, COMFORT_TAG, TIME_OFF_KIND_LABEL } from "@/lib/labels";
import { can, canActOnDoctorAppointment } from "@/lib/permissions";
import { addDaysISO, isoWeekday, localDayRangeUtc, startOfWeekISO, todayISO, utcToLocal } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { getPatientFlagsBulk } from "@/server/patients/flags";
import { shiftValidOn } from "@/server/scheduling/compute";
import { BLOCKING_STATUSES, allowedTargets } from "@/server/scheduling/rules";
import type { CalendarAppointment, CalendarColumn, CalendarColumnsMode, CalendarData, CalendarView, FlagDTO } from "./types";

/**
 * Calendar data (WP6, design system §6.8): the day view with one column per doctor (or cabinet)
 * of the clinic scope, and the week view of one doctor. Everything is converted to local minutes
 * here, so the client only lays out numbers.
 */

export const APPOINTMENT_ROW_SELECT = {
  id: true,
  status: true,
  source: true,
  startsAt: true,
  endsAt: true,
  locationId: true,
  doctorId: true,
  cabinetId: true,
  patientId: true,
  leadId: true,
  serviceId: true,
  reason: true,
  comfort: true,
  comfortNote: true,
  wantsSedation: true,
  notes: true,
  confirmedAt: true,
  arrivedAt: true,
  startedAt: true,
  completedAt: true,
  cancelReason: true,
  updatedAt: true,
  location: { select: { shortName: true } },
  doctor: { select: { publicName: true, honorific: true, lastName: true } },
  cabinet: { select: { name: true } },
  service: { select: { name: true } },
  patient: { select: { firstName: true, lastName: true, phone: true, fileNumber: true, anonymizedAt: true } },
  lead: { select: { name: true, phone: true, forChild: true, childFirstName: true, childAge: true } },
} satisfies Prisma.AppointmentSelect;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof APPOINTMENT_ROW_SELECT }>;

/** „Dr. Mașca”. */
export function shortDoctorName(d: { honorific?: string | null; lastName: string }): string {
  return `${d.honorific?.trim() || "Dr."} ${d.lastName}`;
}

/** The overlays of one appointment (§3.4): patient flags, plus what the booking itself says. */
export function appointmentFlags(row: Pick<AppointmentRow, "source" | "comfort" | "wantsSedation" | "lead">, patientFlags: FlagDTO[] = []): FlagDTO[] {
  const out: FlagDTO[] = [];
  const alerts = patientFlags.filter((f) => f.kind === "alerta");
  out.push(...alerts);
  const comfort = patientFlags.find((f) => f.kind === "confort");
  if (comfort) out.push(comfort);
  else if (row.comfort === "FRICA" || row.comfort === "EMOTII") out.push({ kind: "confort", label: COMFORT_TAG[row.comfort] });
  if (row.wantsSedation) out.push({ kind: "sedare", label: "Inhalosedare" });
  else {
    const sedation = patientFlags.find((f) => f.kind === "sedare");
    if (sedation) out.push(sedation);
  }
  const child = patientFlags.find((f) => f.kind === "copil");
  if (child) out.push(child);
  else if (row.lead?.forChild) {
    const name = row.lead.childFirstName?.trim();
    const age = row.lead.childAge != null ? formatYears(row.lead.childAge) : null;
    out.push({ kind: "copil", label: ["Copil", name, age].filter(Boolean).join(", ") });
  }
  if (row.source === "ONLINE") out.push({ kind: "online", label: "Online" });
  return out;
}

/** Row → DTO, with the actions this user may take now. */
export function toCalendarAppointment(
  row: AppointmentRow,
  user: Pick<CurrentUser, "role" | "doctorId">,
  patientFlags: FlagDTO[] | undefined,
  now: Date,
): CalendarAppointment {
  const start = utcToLocal(row.startsAt);
  const endMinutes = start.minute + Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000);
  const canManage = canActOnDoctorAppointment(user, row.doctorId);
  const anonymized = !!row.patient?.anonymizedAt;
  const title = row.patient ? personName(row.patient) : (row.lead?.name ?? "Pacient fără nume");
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    dateISO: start.dateISO,
    startMinute: start.minute,
    endMinute: endMinutes,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    locationId: row.locationId,
    locationName: row.location.shortName,
    doctorId: row.doctorId,
    doctorName: shortDoctorName(row.doctor),
    cabinetId: row.cabinetId,
    cabinetName: row.cabinet?.name ?? null,
    patientId: row.patientId,
    leadId: row.leadId,
    title,
    phone: anonymized ? null : (row.patient?.phone ?? row.lead?.phone ?? null),
    fileNumber: row.patient?.fileNumber ?? null,
    serviceId: row.serviceId,
    serviceName: row.service?.name ?? null,
    reason: row.reason,
    comfort: row.comfort,
    comfortNote: row.comfortNote,
    wantsSedation: row.wantsSedation,
    notes: row.notes,
    flags: appointmentFlags(row, patientFlags),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    arrivedAt: row.arrivedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    updatedAt: row.updatedAt.toISOString(),
    actions: canManage ? allowedTargets(row.status, user.role, { completedAt: row.completedAt, startsAt: row.startsAt, now }) : [],
    canManage,
  };
}

/** DTOs for many rows, with patient flags loaded in bulk. */
export async function toCalendarAppointments(rows: AppointmentRow[], user: Pick<CurrentUser, "role" | "doctorId">, now: Date): Promise<CalendarAppointment[]> {
  const flags = await getPatientFlagsBulk(rows.map((r) => r.patientId).filter((v): v is string => !!v));
  return rows.map((r) => toCalendarAppointment(r, user, r.patientId ? flags.get(r.patientId) : undefined, now));
}

// ───────────────────────────── Shifts → open intervals ─────────────────────────────

type ShiftLike = {
  doctorId: string;
  locationId: string;
  cabinetId: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  validFrom: Date | null;
  validUntil: Date | null;
  breaks: { startMinute: number; endMinute: number; label: string | null }[];
};

/** Merges overlapping `[start, end)` pairs. Pure. */
export function mergeRanges(list: [number, number][]): [number, number][] {
  const sorted = [...list].filter(([a, b]) => a < b).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Subtracts the breaks from the shift intervals. Pure. */
export function subtractRanges(base: [number, number][], minus: [number, number][]): [number, number][] {
  let out = mergeRanges(base);
  for (const [ma, mb] of minus) {
    const next: [number, number][] = [];
    for (const [a, b] of out) {
      if (mb <= a || ma >= b) next.push([a, b]);
      else {
        if (ma > a) next.push([a, ma]);
        if (mb < b) next.push([mb, b]);
      }
    }
    out = next;
  }
  return out;
}

function shiftsOnDay(shifts: ShiftLike[], dateISO: string, filter: (s: ShiftLike) => boolean): ShiftLike[] {
  const weekday = isoWeekday(dateISO);
  return shifts.filter((s) => s.weekday === weekday && shiftValidOn(s, dateISO) && filter(s));
}

function openOf(shifts: ShiftLike[]): Pick<CalendarColumn, "open" | "breaks"> {
  const breaks = shifts.flatMap((s) => s.breaks.map((b) => ({ start: b.startMinute, end: b.endMinute, label: b.label })));
  return {
    open: subtractRanges(
      shifts.map((s) => [s.startMinute, s.endMinute] as [number, number]),
      breaks.map((b) => [b.start, b.end] as [number, number]),
    ),
    breaks,
  };
}

/** Clips an instant interval to the local day `dateISO`, in local minutes (null when outside). */
function clipToDay(startsAt: Date, endsAt: Date, dateISO: string): [number, number] | null {
  const { start, end } = localDayRangeUtc(dateISO);
  if (endsAt <= start || startsAt >= end) return null;
  const a = startsAt <= start ? 0 : utcToLocal(startsAt).minute;
  const b = endsAt >= end ? 1440 : utcToLocal(endsAt).minute;
  return a < b ? [a, b] : null;
}

// ───────────────────────────── getCalendarData ─────────────────────────────

export type CalendarQuery = {
  view: CalendarView;
  dateISO: string;
  columnsMode: CalendarColumnsMode;
  doctorId?: string | null;
  scope: ClinicScope;
  now?: Date;
};

function weekTitle(mondayISO: string): string {
  const sunday = addDaysISO(mondayISO, 6);
  const [, m1, d1] = mondayISO.split("-").map(Number);
  const [, m2] = sunday.split("-").map(Number);
  const endLabel = formatDateRo(sunday, "long").split(", ")[1];
  const startLabel = m1 === m2 ? String(d1) : formatDateRo(mondayISO, "long").split(", ")[1];
  return `Săptămâna ${startLabel}–${endLabel}`;
}

/**
 * The calendar for one day (columns = doctors or cabinets of the scope) or one week (columns =
 * the days, for one doctor; default the user's own doctor, else the first in scope).
 */
export async function getCalendarData(user: CurrentUser, q: CalendarQuery): Promise<CalendarData> {
  const now = q.now ?? new Date();
  const locationIds = await scopeLocationIds(q.scope);
  const days = q.view === "saptamana" ? Array.from({ length: 7 }, (_, i) => addDaysISO(startOfWeekISO(q.dateISO), i)) : [q.dateISO];
  const rangeStart = localDayRangeUtc(days[0]).start;
  const rangeEnd = localDayRangeUtc(days[days.length - 1]).end;

  const [locations, doctorsAll, shiftsAll, cabinets] = await Promise.all([
    prisma.location.findMany({ where: { id: { in: locationIds } }, orderBy: [{ sortOrder: "asc" }], select: { id: true, shortName: true } }),
    prisma.doctor.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
      select: { id: true, publicName: true, honorific: true, lastName: true },
    }),
    prisma.workShift.findMany({
      where: { locationId: { in: locationIds } },
      select: {
        doctorId: true,
        locationId: true,
        cabinetId: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
        validFrom: true,
        validUntil: true,
        breaks: { select: { startMinute: true, endMinute: true, label: true } },
      },
    }),
    prisma.cabinet.findMany({
      where: { locationId: { in: locationIds }, active: true },
      orderBy: [{ location: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, locationId: true },
    }),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.shortName]));
  const multiClinic = locations.length > 1;
  const doctorsInScope = doctorsAll.filter((d) => shiftsAll.some((s) => s.doctorId === d.id));

  // Week view: one doctor.
  let selectedDoctorId: string | null = null;
  if (q.view === "saptamana") {
    const pool = doctorsInScope.length > 0 ? doctorsInScope : doctorsAll;
    selectedDoctorId =
      (q.doctorId && doctorsAll.some((d) => d.id === q.doctorId) ? q.doctorId : null) ??
      (user.doctorId && pool.some((d) => d.id === user.doctorId) ? user.doctorId : null) ??
      pool[0]?.id ??
      null;
  }

  const apptWhere: Prisma.AppointmentWhereInput = {
    startsAt: { lt: rangeEnd },
    endsAt: { gt: rangeStart },
    locationId: { in: locationIds },
    ...(selectedDoctorId ? { doctorId: selectedDoctorId } : {}),
  };
  const [rows, timeOff, elsewhere] = await Promise.all([
    prisma.appointment.findMany({ where: apptWhere, orderBy: [{ startsAt: "asc" }], select: APPOINTMENT_ROW_SELECT }),
    prisma.timeOff.findMany({
      where: {
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        OR: [{ doctorId: { not: null } }, { doctorId: null, locationId: { in: locationIds } }],
      },
      select: { doctorId: true, locationId: true, kind: true, startsAt: true, endsAt: true },
    }),
    // A doctor busy at the other clinic is shaded in this scope (§6.2: one doctor, one place).
    prisma.appointment.findMany({
      where: {
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        locationId: { notIn: locationIds },
        status: { in: [...BLOCKING_STATUSES] },
        ...(selectedDoctorId ? { doctorId: selectedDoctorId } : {}),
      },
      select: { doctorId: true, startsAt: true, endsAt: true, location: { select: { shortName: true } } },
    }),
  ]);
  const appointments = await toCalendarAppointments(rows, user, now);

  const blockedFor = (doctorId: string | null, locationId: string | null, dateISO: string) => {
    const out: CalendarColumn["timeOff"] = [];
    for (const t of timeOff) {
      const applies = doctorId ? t.doctorId === doctorId : false;
      const closure = t.doctorId === null && (locationId ? t.locationId === locationId : true);
      if (!applies && !closure) continue;
      const r = clipToDay(t.startsAt, t.endsAt, dateISO);
      if (r) out.push({ start: r[0], end: r[1], label: closure ? `Clinică închisă: ${TIME_OFF_KIND_LABEL[t.kind].toLowerCase()}` : TIME_OFF_KIND_LABEL[t.kind] });
    }
    if (doctorId) {
      for (const e of elsewhere) {
        if (e.doctorId !== doctorId) continue;
        const r = clipToDay(e.startsAt, e.endsAt, dateISO);
        if (r) out.push({ start: r[0], end: r[1], label: `La ${e.location.shortName}` });
      }
    }
    return out;
  };

  let columns: CalendarColumn[] = [];
  const fallbackLocation = locationIds[0] ?? "";
  if (q.view === "saptamana") {
    const doctor = doctorsAll.find((d) => d.id === selectedDoctorId);
    if (doctor) {
      columns = days.map((dateISO) => {
        const dayShifts = shiftsOnDay(shiftsAll, dateISO, (s) => s.doctorId === doctor.id);
        return {
          id: dateISO,
          kind: "day" as const,
          label: capitalize(formatDateRo(dateISO, "weekday")),
          sublabel: multiClinic && dayShifts[0] ? locationName.get(dayShifts[0].locationId) : undefined,
          dateISO,
          doctorId: doctor.id,
          cabinetId: dayShifts[0]?.cabinetId ?? null,
          locationId: dayShifts[0]?.locationId ?? fallbackLocation,
          ...openOf(dayShifts),
          timeOff: blockedFor(doctor.id, dayShifts[0]?.locationId ?? null, dateISO),
        };
      });
      // Sunday only when something happens on it.
      const sunday = columns[6];
      if (sunday && sunday.open.length === 0 && !appointments.some((a) => a.dateISO === sunday.dateISO)) columns = columns.slice(0, 6);
    }
  } else if (q.columnsMode === "cabinete") {
    const day = q.dateISO;
    columns = cabinets.map((c) => {
      const own = shiftsOnDay(shiftsAll, day, (s) => s.cabinetId === c.id);
      const atLocation = own.length > 0 ? own : shiftsOnDay(shiftsAll, day, (s) => s.locationId === c.locationId);
      const { open } = openOf(atLocation);
      return {
        id: c.id,
        kind: "cabinet" as const,
        label: c.name,
        sublabel: multiClinic ? locationName.get(c.locationId) : undefined,
        dateISO: day,
        doctorId: null,
        cabinetId: c.id,
        locationId: c.locationId,
        open,
        breaks: [],
        timeOff: blockedFor(null, c.locationId, day),
      };
    });
    if (appointments.some((a) => !a.cabinetId)) {
      columns.push({
        id: "none",
        kind: "cabinet",
        label: "Fără cabinet",
        dateISO: day,
        doctorId: null,
        cabinetId: null,
        locationId: fallbackLocation,
        open: [],
        breaks: [],
        timeOff: [],
      });
    }
  } else {
    const day = q.dateISO;
    const working = doctorsInScope.filter(
      (d) => shiftsOnDay(shiftsAll, day, (s) => s.doctorId === d.id).length > 0 || appointments.some((a) => a.doctorId === d.id),
    );
    const extra = doctorsAll.filter((d) => !doctorsInScope.includes(d) && appointments.some((a) => a.doctorId === d.id));
    const list = working.length + extra.length > 0 ? [...working, ...extra] : doctorsInScope;
    columns = list.map((d) => {
      const dayShifts = shiftsOnDay(shiftsAll, day, (s) => s.doctorId === d.id);
      const firstLoc = dayShifts[0]?.locationId ?? appointments.find((a) => a.doctorId === d.id)?.locationId ?? fallbackLocation;
      return {
        id: d.id,
        kind: "doctor" as const,
        label: shortDoctorName(d),
        sublabel: multiClinic ? [...new Set(dayShifts.map((s) => locationName.get(s.locationId)))].filter(Boolean).join(", ") || undefined : undefined,
        dateISO: day,
        doctorId: d.id,
        cabinetId: dayShifts[0]?.cabinetId ?? null,
        locationId: firstLoc,
        ...openOf(dayShifts),
        timeOff: blockedFor(d.id, firstLoc, day),
      };
    });
  }

  // Visible hours: at least 08:00–19:00, widened to every shift and appointment.
  const starts = [480, ...columns.flatMap((c) => c.open.map((o) => o[0])), ...appointments.map((a) => a.startMinute)];
  const ends = [1140, ...columns.flatMap((c) => c.open.map((o) => o[1])), ...appointments.map((a) => a.endMinute)];
  const dayStart = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60);
  const dayEnd = Math.min(1440, Math.ceil(Math.max(...ends) / 60) * 60);

  const today = todayISO(now);
  const scopeLabel = CLINIC_SCOPE_LABEL[q.scope];
  return {
    view: q.view,
    columnsMode: q.view === "saptamana" ? "medici" : q.columnsMode,
    dateISO: q.dateISO,
    weekStartISO: q.view === "saptamana" ? days[0] : q.dateISO,
    title: q.view === "saptamana" ? weekTitle(days[0]) : capitalize(formatDateRo(q.dateISO, "long")),
    todayISO: today,
    nowMinute: utcToLocal(now).minute,
    dayStart,
    dayEnd,
    columns,
    appointments,
    doctors: (doctorsInScope.length > 0 ? doctorsInScope : doctorsAll).map((d) => ({ id: d.id, name: d.publicName, shortName: shortDoctorName(d) })),
    selectedDoctorId,
    role: user.role,
    userDoctorId: user.doctorId,
    canCreate: can(user, ["appointments.manage", "appointments.manageOwn"]),
    scopeLabel,
  };
}

/** One appointment as a DTO (drawer page `/crm/programari/[id]`), or null. */
export async function getAppointmentDTO(user: CurrentUser, id: string, now: Date = new Date()): Promise<CalendarAppointment | null> {
  const row = await prisma.appointment.findUnique({ where: { id }, select: APPOINTMENT_ROW_SELECT });
  if (!row) return null;
  const [dto] = await toCalendarAppointments([row], user, now);
  return dto;
}

/** Elapsed minutes of the „in the chair” timer (Sosit since arrival, În tratament since start). */
export function runningMinutes(a: Pick<CalendarAppointment, "status" | "arrivedAt" | "startedAt">, now: Date): number | null {
  const since = a.status === "IN_TRATAMENT" ? a.startedAt : a.status === "SOSIT" ? a.arrivedAt : null;
  if (!since) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
}
