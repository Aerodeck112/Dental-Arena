import "server-only";
import { prisma, type Db } from "@/lib/db";
import { getSettings, type SettingsMap } from "@/lib/settings";
import { addDaysISO, isValidDateISO, localToUtc, todayISO, utcToLocal } from "@/lib/time";
import { computeSlots, type ComputeAppointment, type ComputeInput, type ComputeShift } from "./compute";
import { BLOCKING_STATUSES } from "./rules";
import type { DaySlots, Slot, SlotQuery } from "./types";

/**
 * Slot availability (docs/architecture.md §6.1). Loads the data for a range in four queries
 * (shifts with breaks, time off, blocking appointments, location hours), after resolving the
 * service and the eligible doctors, then runs the pure `computeSlots`.
 */

export const MAX_DAYS_PER_REQUEST = 14;

export type AvailabilityContext = {
  days: DaySlots[];
  input: ComputeInput;
  service: { id: string; categoryId: string; durationMinutes: number; bookableOnline: boolean; onlineLabel: string | null } | null;
};

type BookingSettings = SettingsMap["booking"];

function clampDays(days: number, settings: BookingSettings): number {
  const max = Math.min(MAX_DAYS_PER_REQUEST, settings.maxDaysPerRequest);
  return Math.max(1, Math.min(max, Math.floor(Number.isFinite(days) ? days : 7)));
}

function emptyDays(fromDateISO: string, days: number): DaySlots[] {
  return Array.from({ length: days }, (_, i) => ({ dateISO: addDaysISO(fromDateISO, i), slots: [] }));
}

/**
 * The full computation with its inputs, reading through `db` (the caller's transaction when
 * re-checking a slot at submit). `settings` defaults to the stored `booking` settings.
 */
export async function loadAvailability(db: Db, q: SlotQuery, settings?: BookingSettings): Promise<AvailabilityContext> {
  const booking = settings ?? (await getSettings("booking"));
  const now = q.now ?? new Date();
  if (!isValidDateISO(q.fromDateISO)) throw new RangeError("fromDateISO");
  const days = clampDays(q.days, booking);
  const base: ComputeInput = {
    locationId: q.locationId,
    fromDateISO: q.fromDateISO,
    days,
    durationMinutes: 30,
    channel: q.channel,
    now,
    doctors: [],
    shifts: [],
    timeOff: [],
    appointments: [],
    locationHours: [],
    settings: booking,
  };

  const [service, location] = await Promise.all([
    db.service.findUnique({
      where: { id: q.serviceId },
      select: { id: true, categoryId: true, durationMinutes: true, bookableOnline: true, onlineLabel: true, active: true },
    }),
    db.location.findUnique({ where: { id: q.locationId }, select: { id: true, active: true } }),
  ]);
  const svc = service ? { id: service.id, categoryId: service.categoryId, durationMinutes: service.durationMinutes, bookableOnline: service.bookableOnline, onlineLabel: service.onlineLabel } : null;
  const nothing = { days: emptyDays(q.fromDateISO, days), input: base, service: svc };
  if (!service || !service.active || !location || !location.active) return nothing;
  const online = q.channel === "online";
  if (online && (!booking.onlineEnabled || !service.bookableOnline)) return nothing;

  // Step 2: eligible doctors.
  const categoryRows = await db.doctorCategory.count({ where: { categoryId: service.categoryId } });
  const doctors = await db.doctor.findMany({
    where: {
      active: true,
      ...(online ? { acceptsOnlineBooking: true } : {}),
      ...(q.doctorId ? { id: q.doctorId } : {}),
      ...(categoryRows > 0 ? { categories: { some: { categoryId: service.categoryId } } } : {}),
    },
    select: { id: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const input: ComputeInput = { ...base, durationMinutes: service.durationMinutes, doctors };
  if (doctors.length === 0) return { days: emptyDays(q.fromDateISO, days), input, service: svc };

  // Step 3: four queries over [rangeStart, rangeEnd), widened by the buffer for appointments.
  const doctorIds = doctors.map((d) => d.id);
  const rangeStart = localToUtc(q.fromDateISO, 0);
  const rangeEnd = localToUtc(addDaysISO(q.fromDateISO, days), 0);
  const pad = booking.bufferMinutes * 60_000;

  const shifts = await db.workShift.findMany({
    where: {
      doctorId: { in: doctorIds },
      locationId: q.locationId,
      ...(online ? { onlineBooking: true } : {}),
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lt: rangeEnd } }] },
        { OR: [{ validUntil: null }, { validUntil: { gt: rangeStart } }] },
      ],
    },
    select: {
      id: true,
      doctorId: true,
      locationId: true,
      cabinetId: true,
      weekday: true,
      startMinute: true,
      endMinute: true,
      validFrom: true,
      validUntil: true,
      breaks: { select: { startMinute: true, endMinute: true } },
    },
  });
  const cabinetIds = [...new Set(shifts.map((s) => s.cabinetId).filter((c): c is string => !!c))];

  const [timeOff, appointments, locationHours] = await Promise.all([
    db.timeOff.findMany({
      where: {
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        OR: [{ doctorId: { in: doctorIds } }, { doctorId: null, locationId: q.locationId }],
      },
      select: { doctorId: true, locationId: true, startsAt: true, endsAt: true },
    }),
    db.appointment.findMany({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startsAt: { lt: new Date(rangeEnd.getTime() + pad) },
        endsAt: { gt: new Date(rangeStart.getTime() - pad) },
        OR: [{ doctorId: { in: doctorIds } }, ...(cabinetIds.length > 0 ? [{ cabinetId: { in: cabinetIds } }] : [])],
      },
      select: { id: true, doctorId: true, locationId: true, cabinetId: true, startsAt: true, endsAt: true },
    }),
    db.locationHours.findMany({
      where: { locationId: q.locationId },
      select: { weekday: true, openMinute: true, closeMinute: true },
    }),
  ]);

  const full: ComputeInput = {
    ...input,
    shifts: shifts as ComputeShift[],
    timeOff,
    appointments: appointments as ComputeAppointment[],
    locationHours,
  };
  return { days: computeSlots(full), input: full, service: svc };
}

/** Free slots for the wizard and the CRM (`DaySlots[]`, sorted; empty days kept). */
export async function getAvailableSlots(q: SlotQuery): Promise<DaySlots[]> {
  return (await loadAvailability(prisma, q)).days;
}

/**
 * The next `count` free online slots at a location for the home panel and the wizard's clinic
 * panels. Scans forward in 7-day windows up to the horizon. Any error, or nothing free, gives `[]`
 * (the caller then shows the phone fallback).
 */
export async function getNextFreeSlots(locationId: string, count: number = 3, serviceCode?: string): Promise<Slot[]> {
  try {
    const booking = await getSettings("booking");
    if (!booking.onlineEnabled || count <= 0) return [];
    const code = serviceCode ?? booking.homeServiceCode;
    const service = await prisma.service.findUnique({ where: { code }, select: { id: true } });
    if (!service) return [];
    const now = new Date();
    const out: Slot[] = [];
    const first = todayISO(now);
    const last = utcToLocal(new Date(now.getTime() + booking.horizonDays * 86_400_000)).dateISO;
    const settings = { ...booking, maxDaysPerRequest: Math.max(7, booking.maxDaysPerRequest) };
    for (let from = first; from <= last && out.length < count; from = addDaysISO(from, 7)) {
      const { days } = await loadAvailability(
        prisma,
        { locationId, serviceId: service.id, doctorId: null, fromDateISO: from, days: 7, channel: "online", now },
        settings,
      );
      for (const d of days) {
        for (const s of d.slots) {
          if (out.length < count) out.push(s);
        }
      }
    }
    return out;
  } catch (e) {
    console.error(`[availability] getNextFreeSlots: ${e instanceof Error ? e.name : typeof e}`);
    return [];
  }
}

/**
 * Resolves the public API parameters: `clinica` (slug or id), `serviciu` (code or id), `medic`
 * (slug or id). Returns null for anything unknown or inactive.
 */
export async function resolvePublicSlotParams(p: {
  clinica: string;
  serviciu: string;
  medic?: string;
}): Promise<{ locationId: string; serviceId: string; doctorId: string | null } | { error: string }> {
  const [location, service, doctor] = await Promise.all([
    prisma.location.findFirst({ where: { active: true, OR: [{ slug: p.clinica }, { id: p.clinica }] }, select: { id: true } }),
    prisma.service.findFirst({ where: { active: true, OR: [{ code: p.serviciu }, { id: p.serviciu }] }, select: { id: true } }),
    p.medic
      ? prisma.doctor.findFirst({ where: { active: true, OR: [{ slug: p.medic }, { id: p.medic }] }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (!location) return { error: "Clinica nu există. Folosiți cristesti sau ludus." };
  if (!service) return { error: "Serviciul nu există." };
  if (p.medic && !doctor) return { error: "Medicul nu există." };
  return { locationId: location.id, serviceId: service.id, doctorId: doctor?.id ?? null };
}
