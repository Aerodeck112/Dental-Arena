import { describe, expect, it } from "vitest";
import { localToUtc } from "@/lib/time";
import {
  computeSlots,
  gridStarts,
  pickDoctor,
  shiftContaining,
  shiftValidOn,
  type ComputeAppointment,
  type ComputeInput,
  type ComputeShift,
  type ComputeTimeOff,
} from "../compute";

// 2026-10-05 is a Monday (ISO weekday 1). On Sunday 2026-10-25 the clocks go back (04:00 EEST becomes 03:00 EET).
const MON = "2026-10-05";
const TUE = "2026-10-06";
const L1 = "loc-cristesti";
const L2 = "loc-ludus";
const DA = "doc-a";
const DB = "doc-b";
const C1 = "cab-1";

const at = (dateISO: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return localToUtc(dateISO, h * 60 + m);
};

const settings = { slotStepMinutes: 15, minLeadMinutes: 120, horizonDays: 30, bufferMinutes: 0, morningEndsAtMinute: 780 };
// "now" far in the past relative to the test days, so lead time and horizon do not interfere unless a test sets them.
const EARLY = at("2026-10-01", "08:00");

function shift(p: Partial<ComputeShift> & { weekday: number; start: string; end: string }): ComputeShift {
  const [sh, sm] = p.start.split(":").map(Number);
  const [eh, em] = p.end.split(":").map(Number);
  return {
    doctorId: p.doctorId ?? DA,
    locationId: p.locationId ?? L1,
    cabinetId: p.cabinetId ?? null,
    weekday: p.weekday,
    startMinute: sh * 60 + sm,
    endMinute: eh * 60 + em,
    validFrom: p.validFrom ?? null,
    validUntil: p.validUntil ?? null,
    breaks: p.breaks ?? [],
  };
}

function input(p: Partial<ComputeInput>): ComputeInput {
  return {
    locationId: L1,
    fromDateISO: MON,
    days: 1,
    durationMinutes: 30,
    channel: "online",
    now: EARLY,
    doctors: [{ id: DA, sortOrder: 1 }],
    shifts: [],
    timeOff: [],
    appointments: [],
    locationHours: [],
    ...p,
    settings: { ...settings, ...(p.settings ?? {}) },
  };
}

const times = (days: ReturnType<typeof computeSlots>, i = 0) => days[i].slots.map((s) => s.localTime);

function appt(doctorId: string, dateISO: string, from: string, to: string, extra: Partial<ComputeAppointment> = {}): ComputeAppointment {
  return { doctorId, locationId: L1, cabinetId: null, startsAt: at(dateISO, from), endsAt: at(dateISO, to), ...extra };
}

describe("computeSlots", () => {
  it("offers grid starts that fit the duration inside a shift", () => {
    const days = computeSlots(input({ shifts: [shift({ weekday: 1, start: "09:00", end: "10:30" })] }));
    expect(days).toHaveLength(1);
    expect(days[0].dateISO).toBe(MON);
    expect(times(days)).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00"]);
    const first = days[0].slots[0];
    expect(first.startsAt).toBe(at(MON, "09:00").toISOString());
    expect(first.endsAt).toBe(at(MON, "09:30").toISOString());
    expect(first.doctorIds).toEqual([DA]);
    expect(first.period).toBe("dimineata");
  });

  it("removes a break in the middle of a shift", () => {
    const days = computeSlots(
      input({ shifts: [shift({ weekday: 1, start: "09:00", end: "12:00", breaks: [{ startMinute: 600, endMinute: 630 }] })] }),
    );
    expect(times(days)).toEqual(["09:00", "09:15", "09:30", "10:30", "10:45", "11:00", "11:15", "11:30"]);
  });

  it("skips grid points covered by an appointment that straddles two of them", () => {
    const days = computeSlots(
      input({
        shifts: [shift({ weekday: 1, start: "09:00", end: "12:00" })],
        appointments: [appt(DA, MON, "10:05", "10:40")],
      }),
    );
    // 09:30 ends at 10:00 (ok); 09:45 would end 10:15 (> 10:05); next grid start after 10:40 is 10:45.
    expect(times(days)).toEqual(["09:00", "09:15", "09:30", "10:45", "11:00", "11:15", "11:30"]);
  });

  it("keeps the buffer free on both sides of an existing appointment", () => {
    const days = computeSlots(
      input({
        settings: { ...settings, bufferMinutes: 10 },
        shifts: [shift({ weekday: 1, start: "09:00", end: "12:00" })],
        appointments: [appt(DA, MON, "10:00", "10:30")],
      }),
    );
    // Free until 09:50 (the new visit needs its cleaning time before 10:00) and again from 10:40.
    expect(times(days)).toEqual(["09:00", "09:15", "10:45", "11:00", "11:15", "11:30"]);
  });

  it("closes the day when the location has a closure (TimeOff without doctor)", () => {
    const closure: ComputeTimeOff = { doctorId: null, locationId: L1, startsAt: at(MON, "00:00"), endsAt: at(TUE, "00:00") };
    const otherClinic: ComputeTimeOff = { doctorId: null, locationId: L2, startsAt: at(TUE, "00:00"), endsAt: at("2026-10-07", "00:00") };
    const days = computeSlots(
      input({
        days: 2,
        shifts: [shift({ weekday: 1, start: "09:00", end: "10:00" }), shift({ weekday: 2, start: "09:00", end: "10:00" })],
        timeOff: [closure, otherClinic],
      }),
    );
    expect(days.map((d) => d.dateISO)).toEqual([MON, TUE]);
    expect(days[0].slots).toEqual([]);
    expect(times(days, 1)).toEqual(["09:00", "09:15", "09:30"]);
  });

  it("honours a doctor's own leave, and a partial-day block", () => {
    const leave: ComputeTimeOff = { doctorId: DA, locationId: null, startsAt: at(MON, "00:00"), endsAt: at(TUE, "00:00") };
    const block: ComputeTimeOff = { doctorId: DA, locationId: L1, startsAt: at(TUE, "09:30"), endsAt: at(TUE, "10:00") };
    const days = computeSlots(
      input({
        days: 2,
        shifts: [shift({ weekday: 1, start: "09:00", end: "10:30" }), shift({ weekday: 2, start: "09:00", end: "10:30" })],
        timeOff: [leave, block],
      }),
    );
    expect(days[0].slots).toEqual([]);
    expect(times(days, 1)).toEqual(["09:00", "10:00"]);
  });

  it("treats a doctor as busy when they have an appointment at the other clinic", () => {
    const days = computeSlots(
      input({
        shifts: [shift({ weekday: 1, start: "09:00", end: "11:00" })],
        appointments: [appt(DA, MON, "09:00", "10:00", { locationId: L2 })],
      }),
    );
    expect(times(days)).toEqual(["10:00", "10:15", "10:30"]);
  });

  it("blocks a shared cabinet booked by another doctor", () => {
    const days = computeSlots(
      input({
        shifts: [shift({ weekday: 1, start: "09:00", end: "11:00", cabinetId: C1 })],
        appointments: [appt(DB, MON, "09:30", "10:15", { cabinetId: C1 })],
      }),
    );
    expect(times(days)).toEqual(["09:00", "10:15", "10:30"]);
  });

  it("ignores another doctor's appointment in a different cabinet", () => {
    const days = computeSlots(
      input({
        shifts: [shift({ weekday: 1, start: "09:00", end: "10:00", cabinetId: C1 })],
        appointments: [appt(DB, MON, "09:00", "10:00", { cabinetId: "cab-2" })],
      }),
    );
    expect(times(days)).toEqual(["09:00", "09:15", "09:30"]);
  });

  it("applies minLeadMinutes across midnight", () => {
    // 22:00 on Monday + 10 h lead = 08:00 on Tuesday.
    const days = computeSlots(
      input({
        days: 2,
        now: at(MON, "22:00"),
        settings: { ...settings, minLeadMinutes: 600 },
        shifts: [shift({ weekday: 1, start: "09:00", end: "23:30" }), shift({ weekday: 2, start: "07:00", end: "09:00" })],
      }),
    );
    expect(days[0].slots).toEqual([]);
    expect(times(days, 1)).toEqual(["08:00", "08:15", "08:30"]);
  });

  it("applies the 2-hour lead time on the same day", () => {
    const days = computeSlots(input({ now: at(MON, "08:50"), shifts: [shift({ weekday: 1, start: "09:00", end: "12:00" })] }));
    expect(times(days)[0]).toBe("11:00");
  });

  it("stops at the online horizon and lets the CRM book from now", () => {
    const now = at(MON, "10:07");
    const shifts = [shift({ weekday: 1, start: "09:00", end: "12:00" }), shift({ weekday: 2, start: "09:00", end: "10:00" })];
    const online = computeSlots(input({ days: 2, now, settings: { ...settings, horizonDays: 1 }, shifts }));
    // Horizon = now + 1 day = Tuesday 10:07: Tuesday 09:00–09:30 is inside, nothing on Monday after the lead time beyond 12:00.
    expect(times(online, 1)).toEqual(["09:00", "09:15", "09:30"]);
    const crm = computeSlots(input({ days: 1, now, channel: "crm", shifts }));
    expect(times(crm)[0]).toBe("10:15");
  });

  it("keeps the 09:00 slots on the DST change of 25 October 2026", () => {
    const shifts = [6, 7, 1].map((weekday) => shift({ weekday, start: "09:00", end: "10:00" }));
    const days = computeSlots(input({ fromDateISO: "2026-10-24", days: 3, shifts }));
    expect(days.map((d) => d.dateISO)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
    for (const d of days) expect(d.slots.map((s) => s.localTime)).toEqual(["09:00", "09:15", "09:30"]);
    // Summer time (UTC+3) on Saturday, winter time (UTC+2) from Sunday.
    expect(days[0].slots[0].startsAt).toBe("2026-10-24T06:00:00.000Z");
    expect(days[1].slots[0].startsAt).toBe("2026-10-25T07:00:00.000Z");
    expect(days[2].slots[0].startsAt).toBe("2026-10-26T07:00:00.000Z");
    // A 30-minute visit lasts 30 real minutes on the change day too.
    expect(Date.parse(days[1].slots[0].endsAt) - Date.parse(days[1].slots[0].startsAt)).toBe(30 * 60_000);
  });

  it("keeps the spring change (29 March 2026) on the local grid as well", () => {
    const days = computeSlots(input({ fromDateISO: "2026-03-29", days: 1, now: at("2026-03-01", "08:00"), shifts: [shift({ weekday: 7, start: "09:00", end: "09:30" })] }));
    expect(times(days)).toEqual(["09:00"]);
    expect(days[0].slots[0].startsAt).toBe("2026-03-29T06:00:00.000Z");
  });

  it("de-duplicates „Oricare medic”: one slot per time with every free doctor", () => {
    const days = computeSlots(
      input({
        doctors: [
          { id: DB, sortOrder: 2 },
          { id: DA, sortOrder: 1 },
        ],
        shifts: [shift({ weekday: 1, start: "09:00", end: "10:00" }), shift({ weekday: 1, start: "09:30", end: "10:30", doctorId: DB })],
        appointments: [appt(DA, MON, "09:00", "09:15")],
      }),
    );
    const slots = days[0].slots;
    expect(slots.map((s) => s.localTime)).toEqual(["09:15", "09:30", "09:45", "10:00"]);
    expect(new Set(slots.map((s) => s.startsAt)).size).toBe(slots.length);
    expect(slots.find((s) => s.localTime === "09:30")?.doctorIds).toEqual([DA, DB]);
    expect(slots.find((s) => s.localTime === "09:15")?.doctorIds).toEqual([DA]);
    expect(slots.find((s) => s.localTime === "10:00")?.doctorIds).toEqual([DB]);
  });

  it("clips shifts to the location hours, and closes days without hours", () => {
    const days = computeSlots(
      input({
        days: 2,
        shifts: [shift({ weekday: 1, start: "08:00", end: "10:00" }), shift({ weekday: 2, start: "08:00", end: "10:00" })],
        locationHours: [{ weekday: 1, openMinute: 540, closeMinute: 1140 }],
      }),
    );
    expect(times(days)).toEqual(["09:00", "09:15", "09:30"]);
    expect(days[1].slots).toEqual([]);
  });

  it("respects the shift validity window and the weekday", () => {
    const days = computeSlots(
      input({
        days: 9,
        shifts: [
          shift({ weekday: 1, start: "09:00", end: "09:30", validFrom: at("2026-10-12", "00:00") }),
          shift({ weekday: 2, start: "09:00", end: "09:30", validUntil: at("2026-10-07", "00:00") }),
        ],
      }),
    );
    const withSlots = days.filter((d) => d.slots.length > 0).map((d) => d.dateISO);
    expect(withSlots).toEqual(["2026-10-06", "2026-10-12"]);
    expect(days).toHaveLength(9);
  });

  it("splits morning and afternoon at morningEndsAtMinute", () => {
    const days = computeSlots(input({ shifts: [shift({ weekday: 1, start: "12:30", end: "13:30" })] }));
    expect(days[0].slots.map((s) => [s.localTime, s.period])).toEqual([
      ["12:30", "dimineata"],
      ["12:45", "dimineata"],
      ["13:00", "dupa-amiaza"],
    ]);
  });

  it("aligns starts to the grid when a free interval starts off-grid, and honours the step", () => {
    const days = computeSlots(
      input({
        settings: { ...settings, slotStepMinutes: 30 },
        shifts: [shift({ weekday: 1, start: "09:10", end: "11:00" })],
      }),
    );
    expect(times(days)).toEqual(["09:30", "10:00", "10:30"]);
  });

  it("returns nothing for a duration longer than the free time", () => {
    const days = computeSlots(input({ durationMinutes: 120, shifts: [shift({ weekday: 1, start: "09:00", end: "10:30" })] }));
    expect(days[0].slots).toEqual([]);
  });
});

describe("helpers", () => {
  it("gridStarts works in local wall-clock minutes", () => {
    const f = { start: at(MON, "09:05").getTime(), end: at(MON, "10:00").getTime() };
    expect(gridStarts(MON, f, 15, 15).map((t) => new Date(t).toISOString())).toEqual([
      at(MON, "09:15").toISOString(),
      at(MON, "09:30").toISOString(),
      at(MON, "09:45").toISOString(),
    ]);
  });

  it("shiftValidOn treats validFrom as inclusive and validUntil as exclusive", () => {
    const s = { validFrom: at("2026-10-05", "00:00"), validUntil: at("2026-10-10", "00:00") };
    expect(shiftValidOn(s, "2026-10-04")).toBe(false);
    expect(shiftValidOn(s, "2026-10-05")).toBe(true);
    expect(shiftValidOn(s, "2026-10-09")).toBe(true);
    expect(shiftValidOn(s, "2026-10-10")).toBe(false);
  });

  it("shiftContaining finds the shift (and cabinet) of a slot", () => {
    const shifts = [shift({ weekday: 1, start: "09:00", end: "12:00", cabinetId: C1 }), shift({ weekday: 1, start: "13:00", end: "15:00" })];
    expect(shiftContaining(shifts, DA, L1, at(MON, "11:30"), at(MON, "12:00"))?.cabinetId).toBe(C1);
    expect(shiftContaining(shifts, DA, L1, at(MON, "11:45"), at(MON, "12:15"))).toBeNull();
    expect(shiftContaining(shifts, DA, L2, at(MON, "09:00"), at(MON, "09:30"))).toBeNull();
  });

  it("pickDoctor prefers the fewest booked minutes that day, then sortOrder", () => {
    const doctors = [
      { id: DA, sortOrder: 1 },
      { id: DB, sortOrder: 2 },
    ];
    expect(pickDoctor([DA, DB], MON, [], doctors)).toBe(DA);
    const busyA = [appt(DA, MON, "09:00", "10:00"), appt(DB, MON, "11:00", "11:30")];
    expect(pickDoctor([DA, DB], MON, busyA, doctors)).toBe(DB);
    // Appointments on other days do not count.
    expect(pickDoctor([DA, DB], MON, [appt(DA, TUE, "09:00", "12:00")], doctors)).toBe(DA);
    expect(pickDoctor([], MON, [], doctors)).toBeNull();
    // Deterministic regardless of input order.
    expect(pickDoctor([DB, DA], MON, [], doctors)).toBe(DA);
  });
});
