import { addDaysISO, isoWeekday, localToUtc, minutesToHHMM, utcToLocal } from "@/lib/time";
import { clipTo, interval, MINUTE_MS, normalize, subtract, type Interval } from "./intervals";
import type { DaySlots, Slot } from "./types";

/**
 * The pure slot-availability computation (docs/architecture.md §6.1, steps 4–7). No Prisma and
 * no clock: every input, including `now`, is passed in, so it is unit-tested directly
 * (compute.test.ts), DST change of 25 Oct 2026 included.
 */

export type ComputeShift = {
  id?: string;
  doctorId: string;
  locationId: string;
  cabinetId: string | null;
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday: number;
  startMinute: number;
  endMinute: number;
  /** Inclusive; local midnight saved as UTC. */
  validFrom: Date | null;
  /** Exclusive. */
  validUntil: Date | null;
  breaks: { startMinute: number; endMinute: number }[];
};

export type ComputeTimeOff = { doctorId: string | null; locationId: string | null; startsAt: Date; endsAt: Date };

/** A blocking appointment (status in BLOCKING_STATUSES), at any location. */
export type ComputeAppointment = {
  id?: string;
  doctorId: string;
  locationId: string;
  cabinetId: string | null;
  startsAt: Date;
  endsAt: Date;
};

export type ComputeLocationHours = { weekday: number; openMinute: number; closeMinute: number };

export type ComputeSettings = {
  slotStepMinutes: number;
  minLeadMinutes: number;
  horizonDays: number;
  bufferMinutes: number;
  morningEndsAtMinute: number;
};

export type ComputeInput = {
  locationId: string;
  fromDateISO: string;
  days: number;
  /** Service duration D, 5–480 minutes. */
  durationMinutes: number;
  channel: "online" | "crm";
  now: Date;
  /** Eligible doctors (§6.1 step 2), already filtered. */
  doctors: { id: string; sortOrder: number }[];
  shifts: ComputeShift[];
  timeOff: ComputeTimeOff[];
  appointments: ComputeAppointment[];
  /** Hours of `locationId`. Empty = shifts alone decide. */
  locationHours: ComputeLocationHours[];
  settings: ComputeSettings;
};

/** True when the shift's validity window contains local date `dateISO`. */
export function shiftValidOn(s: Pick<ComputeShift, "validFrom" | "validUntil">, dateISO: string): boolean {
  if (s.validFrom && utcToLocal(s.validFrom).dateISO > dateISO) return false;
  if (s.validUntil && utcToLocal(s.validUntil).dateISO <= dateISO) return false;
  return true;
}

/** The shifts of `doctorId` at `locationId` on local date `dateISO` (step 4.1). */
export function shiftsOn(shifts: readonly ComputeShift[], doctorId: string, locationId: string, dateISO: string): ComputeShift[] {
  const weekday = isoWeekday(dateISO);
  return shifts.filter(
    (s) =>
      s.doctorId === doctorId &&
      s.locationId === locationId &&
      s.weekday === weekday &&
      s.endMinute > s.startMinute &&
      shiftValidOn(s, dateISO),
  );
}

function localInterval(dateISO: string, startMinute: number, endMinute: number): Interval {
  return interval(localToUtc(dateISO, startMinute), localToUtc(dateISO, endMinute));
}

/**
 * Free intervals of one doctor on one local day at the location (steps 4.1–4.5), together with
 * the shift each one comes from (for the cabinet at submit).
 */
export function freeIntervals(
  input: Pick<ComputeInput, "locationId" | "shifts" | "timeOff" | "appointments" | "locationHours" | "settings">,
  doctorId: string,
  dateISO: string,
): { shift: ComputeShift; free: Interval[] }[] {
  const weekday = isoWeekday(dateISO);
  const buffer = input.settings.bufferMinutes * MINUTE_MS;
  const hasHours = input.locationHours.length > 0;
  const hoursToday = input.locationHours
    .filter((h) => h.weekday === weekday && h.closeMinute > h.openMinute)
    .map((h) => localInterval(dateISO, h.openMinute, h.closeMinute));

  const timeOff = input.timeOff
    .filter(
      (t) =>
        (t.doctorId === doctorId && (t.locationId === null || t.locationId === input.locationId)) ||
        (t.doctorId === null && t.locationId === input.locationId),
    )
    .map((t) => interval(t.startsAt, t.endsAt));

  // A doctor cannot be in two places at once: their appointments at every location count.
  // The buffer (cleaning time) is kept on both sides of an existing appointment, so a new one
  // neither starts during the cleaning after it nor ends less than the buffer before it.
  const own = input.appointments
    .filter((a) => a.doctorId === doctorId)
    .map((a) => ({ start: a.startsAt.getTime() - buffer, end: a.endsAt.getTime() + buffer }));

  const out: { shift: ComputeShift; free: Interval[] }[] = [];
  for (const shift of shiftsOn(input.shifts, doctorId, input.locationId, dateISO)) {
    let open: Interval[] = [localInterval(dateISO, shift.startMinute, shift.endMinute)];
    if (hasHours) open = clipTo(open, hoursToday);
    const breaks = shift.breaks
      .filter((b) => b.endMinute > b.startMinute)
      .map((b) => localInterval(dateISO, b.startMinute, b.endMinute));
    const cabinetBusy = shift.cabinetId
      ? input.appointments
          .filter((a) => a.cabinetId === shift.cabinetId && a.doctorId !== doctorId)
          .map((a) => ({ start: a.startsAt.getTime() - buffer, end: a.endsAt.getTime() + buffer }))
      : [];
    const free = subtract(open, [...breaks, ...timeOff, ...own, ...cabinetBusy]);
    if (free.length > 0) out.push({ shift, free });
  }
  return out;
}

/**
 * Candidate starts inside one free interval (step 4.6): local minutes that are multiples of the
 * grid step, from the first grid point at or after `a`, while `t + D <= b`. Built from local
 * wall-clock minutes through `localToUtc`, so a 09:00 shift yields 09:00 on DST days too.
 */
export function gridStarts(dateISO: string, free: Interval, durationMinutes: number, stepMinutes: number): number[] {
  const step = Math.max(1, Math.floor(stepMinutes));
  const D = durationMinutes * MINUTE_MS;
  const startLocal = utcToLocal(new Date(free.start));
  // A free interval always lies inside the local day; guard anyway.
  let m = startLocal.dateISO === dateISO ? Math.ceil(startLocal.minute / step) * step : 0;
  const out: number[] = [];
  for (; m < 1440; m += step) {
    const t = localToUtc(dateISO, m).getTime();
    if (t < free.start) continue;
    if (t + D > free.end) break;
    out.push(t);
  }
  return out;
}

/** Steps 4.6 (lead time and horizon) as a predicate on a start instant. */
export function startAllowed(t: number, channel: "online" | "crm", now: Date, settings: ComputeSettings): boolean {
  const n = now.getTime();
  if (channel === "online") {
    return t >= n + settings.minLeadMinutes * MINUTE_MS && t < n + settings.horizonDays * 1440 * MINUTE_MS;
  }
  return t >= n;
}

/**
 * §6.1 steps 4–6: per local date and eligible doctor, the free starts; merged across doctors
 * (step 5) so „Oricare medic” shows each time once with every doctor who can take it. Days
 * without slots are kept with `slots: []`. Sorted by date, then time.
 */
export function computeSlots(input: ComputeInput): DaySlots[] {
  const days = Math.max(0, Math.floor(input.days));
  const order = new Map(input.doctors.map((d) => [d.id, d.sortOrder]));
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b);
  const D = input.durationMinutes * MINUTE_MS;
  const result: DaySlots[] = [];

  for (let i = 0; i < days; i++) {
    const dateISO = addDaysISO(input.fromDateISO, i);
    const starts = new Map<number, Set<string>>();
    for (const doctor of input.doctors) {
      for (const { free } of freeIntervals(input, doctor.id, dateISO)) {
        for (const f of free) {
          for (const t of gridStarts(dateISO, f, input.durationMinutes, input.settings.slotStepMinutes)) {
            if (!startAllowed(t, input.channel, input.now, input.settings)) continue;
            let set = starts.get(t);
            if (!set) starts.set(t, (set = new Set()));
            set.add(doctor.id);
          }
        }
      }
    }
    const slots: Slot[] = [...starts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, ids]) => {
        const minute = utcToLocal(new Date(t)).minute;
        return {
          startsAt: new Date(t).toISOString(),
          endsAt: new Date(t + D).toISOString(),
          localTime: minutesToHHMM(minute),
          period: minute < input.settings.morningEndsAtMinute ? "dimineata" : "dupa-amiaza",
          doctorIds: [...ids].sort(byOrder),
        };
      });
    result.push({ dateISO, slots });
  }
  return result;
}

/**
 * The shift of `doctorId` that contains `[startsAt, endsAt)` on its local day, if any (used to
 * pick the cabinet at submit).
 */
export function shiftContaining(
  shifts: readonly ComputeShift[],
  doctorId: string,
  locationId: string,
  startsAt: Date,
  endsAt: Date,
): ComputeShift | null {
  const { dateISO } = utcToLocal(startsAt);
  for (const s of shiftsOn(shifts, doctorId, locationId, dateISO)) {
    const open = localInterval(dateISO, s.startMinute, s.endMinute);
    if (open.start <= startsAt.getTime() && endsAt.getTime() <= open.end) return s;
  }
  return null;
}

/**
 * §6.1 step 7: for „Oricare medic”, the doctor with the fewest booked minutes that local day
 * (blocking appointments at any location), then the lowest `sortOrder`, then the id. Stable and
 * deterministic.
 */
export function pickDoctor(
  doctorIds: readonly string[],
  dateISO: string,
  appointments: readonly ComputeAppointment[],
  doctors: readonly { id: string; sortOrder: number }[],
): string | null {
  if (doctorIds.length === 0) return null;
  const order = new Map(doctors.map((d) => [d.id, d.sortOrder]));
  const booked = new Map<string, number>();
  for (const a of appointments) {
    if (!doctorIds.includes(a.doctorId)) continue;
    if (utcToLocal(a.startsAt).dateISO !== dateISO) continue;
    booked.set(a.doctorId, (booked.get(a.doctorId) ?? 0) + (a.endsAt.getTime() - a.startsAt.getTime()) / MINUTE_MS);
  }
  return [...doctorIds].sort(
    (a, b) =>
      (booked.get(a) ?? 0) - (booked.get(b) ?? 0) ||
      (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      a.localeCompare(b),
  )[0];
}

/** Merges free intervals of several shifts (exported for tests and the CRM day view). */
export function mergedFree(parts: { free: Interval[] }[]): Interval[] {
  return normalize(parts.flatMap((p) => p.free));
}
