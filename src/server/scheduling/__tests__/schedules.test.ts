import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp4.db";
});

import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { addDaysISO, localToUtc } from "@/lib/time";
import { loadAvailability } from "../availability";
import {
  createTimeOff,
  deleteShift,
  deleteTimeOff,
  getScheduleEditorData,
  listTimeOff,
  saveShift,
  shiftProblems,
  shiftSchema,
  timeOffInterval,
  timeOffSchema,
  validityOverlaps,
} from "../schedules";
import { makeClinic, testUser, type Clinic } from "./fixtures";

const DAY = "2027-06-16"; // a Wednesday
const NOW = localToUtc("2027-06-10", 8 * 60);
const admin = testUser("ADMIN");
const reception = testUser("RECEPTIE");

let k: Clinic;

beforeAll(async () => {
  k = await makeClinic(prisma);
});

async function slotTimes(doctorId: string | null, day = DAY) {
  const booking = await getSettings("booking");
  const ctx = await loadAvailability(
    prisma,
    { locationId: k.l1.id, serviceId: k.service.id, doctorId, fromDateISO: day, days: 1, channel: "online", now: NOW },
    booking,
  );
  return ctx.days[0].slots.map((s) => s.localTime);
}

function shiftInput(over: Record<string, unknown>) {
  return shiftSchema.parse({ doctorId: k.doctorA.id, locationId: k.l2.id, weekday: "3", start: "09:00", end: "13:00", onlineBooking: "on", ...over });
}

describe("shift rules", () => {
  it("shiftProblems checks the grid, the order and the breaks", () => {
    expect(shiftProblems({ startMinute: 540, endMinute: 1020, breaks: [{ startMinute: 720, endMinute: 750 }] })).toEqual({});
    expect(shiftProblems({ startMinute: 600, endMinute: 540, breaks: [] }).end).toBeDefined();
    expect(shiftProblems({ startMinute: 541, endMinute: 600, breaks: [] }).start).toBeDefined();
    expect(shiftProblems({ startMinute: 540, endMinute: 600, breaks: [{ startMinute: 500, endMinute: 560 }] }).breaks?.[0]).toMatch(/în interiorul programului/);
    expect(
      shiftProblems({ startMinute: 540, endMinute: 1020, breaks: [{ startMinute: 700, endMinute: 760 }, { startMinute: 750, endMinute: 800 }] }).breaks,
    ).toContain("Pauzele nu se pot suprapune.");
    expect(shiftProblems({ startMinute: 540, endMinute: 600, validFrom: "2027-02-01", validUntil: "2027-01-01", breaks: [] }).validUntil).toBeDefined();
  });

  it("parses the form, including several breaks and empty break rows", () => {
    const v = shiftSchema.parse({
      doctorId: k.doctorA.id,
      locationId: k.l1.id,
      weekday: "2",
      start: "08:00",
      end: "16:00",
      breakStart: ["12:00", "", "14:00"],
      breakEnd: ["12:30", "", "14:15"],
    });
    expect(v.breaks).toEqual([
      { startMinute: 720, endMinute: 750 },
      { startMinute: 840, endMinute: 855 },
    ]);
    expect(v.onlineBooking).toBe(false);
    expect(shiftSchema.safeParse({ doctorId: k.doctorA.id, locationId: k.l1.id, weekday: "8", start: "08:00", end: "16:00" }).success).toBe(false);
  });

  it("validityOverlaps treats null as open and the dates as inclusive", () => {
    expect(validityOverlaps({ validFrom: null, validUntil: null }, { validFrom: "2027-01-01", validUntil: null })).toBe(true);
    expect(validityOverlaps({ validFrom: null, validUntil: "2027-01-31" }, { validFrom: "2027-02-01", validUntil: null })).toBe(false);
    expect(validityOverlaps({ validFrom: null, validUntil: "2027-02-01" }, { validFrom: "2027-02-01", validUntil: null })).toBe(true);
  });
});

describe("saveShift", () => {
  it("rejects a shift that overlaps the same doctor's shift at the other clinic, with a clear message", async () => {
    // A works at L1 every day 09:00–17:00, so Wednesday 09:00–13:00 at L2 overlaps.
    const err = await saveShift(shiftInput({}), admin).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("CONFLICT");
    expect((err as DomainError).message).toBe(
      "Intervalul se suprapune cu programul de miercuri, 09:00–17:00, la Testești. Modificați orele sau programul existent.",
    );
  });

  it("rejects another doctor's shift in the same cabinet, but accepts a different validity window", async () => {
    await prisma.workShift.deleteMany({ where: { doctorId: k.doctorB.id, weekday: 4 } });
    const clash = await saveShift(
      shiftSchema.parse({ doctorId: k.doctorB.id, locationId: k.l1.id, cabinetId: k.c1.id, weekday: "4", start: "08:00", end: "10:00" }),
      admin,
    ).catch((e: unknown) => e as DomainError);
    expect(clash).toMatchObject({ code: "CONFLICT", fieldErrors: { cabinetId: [expect.stringMatching(/Cabinet 1 din Testești este folosit joi/)] } });

    await prisma.workShift.updateMany({
      where: { doctorId: k.doctorA.id, weekday: 4 },
      data: { validUntil: localToUtc("2027-07-01", 0) },
    });
    const ok = await saveShift(
      shiftSchema.parse({ doctorId: k.doctorB.id, locationId: k.l1.id, cabinetId: k.c1.id, weekday: "4", start: "08:00", end: "10:00", validFrom: "2027-07-01" }),
      admin,
    );
    expect(ok.id).toBeTruthy();
    const audit = await prisma.auditLog.findFirst({ where: { action: "schedule.update", entityId: k.doctorB.id } });
    expect(JSON.parse(audit?.metadata ?? "{}")).toMatchObject({ op: "shift.create" });
  });

  it("rejects a cabinet from the other clinic", async () => {
    await expect(
      saveShift(shiftSchema.parse({ doctorId: k.doctorB.id, locationId: k.l2.id, cabinetId: k.c1.id, weekday: "6", start: "18:00", end: "20:00" }), admin),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("changes availability immediately: new hours, a removed break, a deleted shift", async () => {
    expect(await slotTimes(k.doctorA.id)).not.toContain("12:00");
    const shift = await prisma.workShift.findFirstOrThrow({ where: { doctorId: k.doctorA.id, weekday: 3, locationId: k.l1.id } });
    await saveShift(
      shiftSchema.parse({ id: shift.id, doctorId: k.doctorA.id, locationId: k.l1.id, cabinetId: k.c1.id, weekday: "3", start: "10:00", end: "14:00", onlineBooking: "on" }),
      admin,
    );
    const times = await slotTimes(k.doctorA.id);
    expect(times[0]).toBe("10:00");
    expect(times).toContain("12:00");
    expect(times.at(-1)).toBe("13:30");

    const data = await getScheduleEditorData(k.doctorA.id);
    expect(data?.isDemo).toBe(false);
    expect(data?.shifts.find((s) => s.id === shift.id)).toMatchObject({ startMinute: 600, endMinute: 840, breaks: [] });

    await deleteShift(shift.id, admin);
    expect(await slotTimes(k.doctorA.id)).toEqual([]);
  });

  it("keeps a shift that is not offered online out of the wizard", async () => {
    await prisma.workShift.updateMany({ where: { doctorId: k.doctorB.id, weekday: 3 }, data: { onlineBooking: false } });
    expect(await slotTimes(k.doctorB.id)).toEqual([]);
    await prisma.workShift.updateMany({ where: { doctorId: k.doctorB.id, weekday: 3 }, data: { onlineBooking: true } });
    expect(await slotTimes(k.doctorB.id)).toContain("09:00");
  });
});

describe("time off", () => {
  it("whole days run midnight to midnight, partial days use the hours", () => {
    const whole = timeOffInterval({ startDate: "2027-10-30", endDate: "2027-10-31" });
    expect(whole.startsAt).toEqual(localToUtc("2027-10-30", 0));
    expect(whole.endsAt).toEqual(localToUtc("2027-11-01", 0));
    const part = timeOffInterval({ startDate: DAY, endDate: DAY, startTime: 600, endTime: 720 });
    expect(part.endsAt.getTime() - part.startsAt.getTime()).toBe(2 * 3_600_000);
    expect(timeOffSchema.safeParse({ kind: "CONCEDIU", startDate: DAY, endDate: DAY }).success).toBe(false);
  });

  it("lets RECEPTIE add time off for any doctor; availability drops it at once", async () => {
    const day = addDaysISO(DAY, 7);
    expect(await slotTimes(k.doctorB.id, day)).toContain("10:00");
    const r = await createTimeOff(
      timeOffSchema.parse({ doctorId: k.doctorB.id, kind: "FORMARE", startDate: day, endDate: day, startTime: "09:00", endTime: "12:00" }),
      reception,
    );
    const times = await slotTimes(k.doctorB.id, day);
    expect(times).not.toContain("10:00");
    expect(times).toContain("12:00");
    const list = await listTimeOff(reception, { doctorId: k.doctorB.id, now: NOW });
    expect(list.find((t) => t.id === r.id)).toMatchObject({ kind: "FORMARE", allDay: false, startMinute: 540, endMinute: 720, canDelete: true });
    await deleteTimeOff(r.id, reception);
    expect(await slotTimes(k.doctorB.id, day)).toContain("10:00");
  });

  it("lets a MEDIC add time off only for themselves, never a clinic closure", async () => {
    const medic = testUser("MEDIC", k.doctorA.id);
    const day = addDaysISO(DAY, 14);
    const own = await createTimeOff(timeOffSchema.parse({ doctorId: k.doctorA.id, kind: "CONCEDIU", startDate: day, endDate: day }), medic);
    expect(own.id).toBeTruthy();
    await expect(
      createTimeOff(timeOffSchema.parse({ doctorId: k.doctorB.id, kind: "CONCEDIU", startDate: day, endDate: day }), medic),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createTimeOff(timeOffSchema.parse({ locationId: k.l1.id, kind: "SARBATOARE", startDate: day, endDate: day }), medic),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listTimeOff(medic, { now: NOW });
    expect(list.find((t) => t.id === own.id)?.canDelete).toBe(true);
  });

  it("a clinic closure removes every doctor's slots and reports the booked appointments inside", async () => {
    const day = addDaysISO(DAY, 21);
    await prisma.appointment.create({
      data: { locationId: k.l1.id, doctorId: k.doctorB.id, startsAt: localToUtc(day, 600), endsAt: localToUtc(day, 630), status: "PROGRAMAT", source: "TELEFON" },
    });
    const r = await createTimeOff(timeOffSchema.parse({ locationId: k.l1.id, kind: "SARBATOARE", startDate: day, endDate: day, reason: "Sfânta Maria" }), admin);
    expect(r.affectedAppointments).toBe(1);
    expect(await slotTimes(null, day)).toEqual([]);
  });
});
