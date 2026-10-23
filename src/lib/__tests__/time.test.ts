import { describe, expect, it } from "vitest";
import {
  CLINIC_TZ,
  addDaysISO,
  addMonthsISO,
  clinicOffsetMinutes,
  diffDaysISO,
  hhmmToMinutes,
  isValidDateISO,
  isoWeekday,
  localDayRangeUtc,
  localToUtc,
  minutesToHHMM,
  monthRangeUtc,
  startOfWeekISO,
  todayISO,
  utcToLocal,
} from "../time";

const HOUR = 60 * 60 * 1000;

describe("time zone", () => {
  it("is Europe/Bucharest", () => {
    expect(CLINIC_TZ).toBe("Europe/Bucharest");
  });

  it("knows the summer and winter offsets", () => {
    expect(clinicOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(180);
    expect(clinicOffsetMinutes(new Date("2026-12-01T12:00:00Z"))).toBe(120);
  });
});

describe("localToUtc", () => {
  it("handles the end of summer time on 25 October 2026 (DST)", () => {
    expect(localToUtc("2026-10-25", 540).toISOString()).toBe("2026-10-25T07:00:00.000Z");
    expect(localToUtc("2026-10-24", 540).toISOString()).toBe("2026-10-24T06:00:00.000Z");
  });

  it("handles the start of summer time on 29 March 2026", () => {
    expect(localToUtc("2026-03-28", 540).toISOString()).toBe("2026-03-28T07:00:00.000Z");
    expect(localToUtc("2026-03-29", 540).toISOString()).toBe("2026-03-29T06:00:00.000Z");
  });

  it("maps a time inside the spring-forward gap to the hour after it", () => {
    // 03:30 does not exist on 29 March; it becomes 04:30 EEST = 01:30Z.
    expect(localToUtc("2026-03-29", 3 * 60 + 30).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("accepts midnight and the next midnight (1440)", () => {
    expect(localToUtc("2026-10-05", 0).toISOString()).toBe("2026-10-04T21:00:00.000Z");
    expect(localToUtc("2026-10-25", 1440).toISOString()).toBe("2026-10-25T22:00:00.000Z");
  });

  it("rejects dates that do not exist", () => {
    expect(() => localToUtc("2026-02-30", 540)).toThrow(RangeError);
    expect(() => localToUtc("05.10.2026", 540)).toThrow(RangeError);
  });

  it("round-trips through utcToLocal on every day of a DST month", () => {
    for (let day = 1; day <= 31; day += 1) {
      const dateISO = `2026-10-${String(day).padStart(2, "0")}`;
      for (const minute of [0, 30, 540, 765, 1170, 1435]) {
        const local = utcToLocal(localToUtc(dateISO, minute));
        expect(local.dateISO).toBe(dateISO);
        expect(local.minute).toBe(minute);
      }
    }
  });
});

describe("utcToLocal", () => {
  it("returns the local date, minute and ISO weekday", () => {
    expect(utcToLocal(new Date("2026-10-25T07:00:00Z"))).toEqual({ dateISO: "2026-10-25", minute: 540, weekday: 7 });
    expect(utcToLocal(new Date("2026-10-05T06:30:00Z"))).toEqual({ dateISO: "2026-10-05", minute: 570, weekday: 1 });
  });

  it("moves late UTC evenings to the next local day", () => {
    expect(utcToLocal(new Date("2026-10-04T21:30:00Z"))).toEqual({ dateISO: "2026-10-05", minute: 30, weekday: 1 });
  });
});

describe("day and month ranges", () => {
  it("gives 24-hour days normally, 23 and 25 hours on DST days", () => {
    const normal = localDayRangeUtc("2026-10-05");
    expect(normal.start.toISOString()).toBe("2026-10-04T21:00:00.000Z");
    expect(normal.end.getTime() - normal.start.getTime()).toBe(24 * HOUR);

    const spring = localDayRangeUtc("2026-03-29");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * HOUR);

    const autumn = localDayRangeUtc("2026-10-25");
    expect(autumn.start.toISOString()).toBe("2026-10-24T21:00:00.000Z");
    expect(autumn.end.toISOString()).toBe("2026-10-25T22:00:00.000Z");
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * HOUR);
  });

  it("covers a local month, across the DST change and the year end", () => {
    const october = monthRangeUtc(2026, 10);
    expect(october.start.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(october.end.toISOString()).toBe("2026-10-31T22:00:00.000Z");

    const december = monthRangeUtc(2026, 12);
    expect(december.start.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(december.end.toISOString()).toBe("2026-12-31T22:00:00.000Z");
  });
});

describe("calendar arithmetic", () => {
  it("todayISO uses the clinic's local date", () => {
    expect(todayISO(new Date("2026-10-04T20:59:00Z"))).toBe("2026-10-04");
    expect(todayISO(new Date("2026-10-04T21:00:00Z"))).toBe("2026-10-05");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDaysISO("2026-10-05", 1)).toBe("2026-10-06");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("adds months, clamping to the end of the month", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-10-05", -6)).toBe("2026-04-05");
    expect(addMonthsISO("2026-11-15", 2)).toBe("2027-01-15");
  });

  it("counts whole days between dates, DST included", () => {
    expect(diffDaysISO("2026-10-20", "2026-10-30")).toBe(10);
    expect(diffDaysISO("2026-10-30", "2026-10-20")).toBe(-10);
  });

  it("computes ISO weekdays and the Monday of the week", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-11")).toBe(7);
    expect(startOfWeekISO("2026-10-11")).toBe("2026-10-05");
    expect(startOfWeekISO("2026-10-05")).toBe("2026-10-05");
    expect(startOfWeekISO("2027-01-01")).toBe("2026-12-28");
  });

  it("validates ISO dates", () => {
    expect(isValidDateISO("2028-02-29")).toBe(true);
    expect(isValidDateISO("2026-02-29")).toBe(false);
    expect(isValidDateISO("2026-13-01")).toBe(false);
    expect(isValidDateISO("2026-1-01")).toBe(false);
  });
});

describe("minutes and HH:MM", () => {
  it("formats minutes after midnight", () => {
    expect(minutesToHHMM(570)).toBe("09:30");
    expect(minutesToHHMM(0)).toBe("00:00");
    expect(minutesToHHMM(1170)).toBe("19:30");
    expect(minutesToHHMM(1440)).toBe("24:00");
  });

  it("parses HH:MM", () => {
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(hhmmToMinutes("9:30")).toBe(570);
    expect(hhmmToMinutes(" 12.15 ")).toBe(735);
    expect(hhmmToMinutes("24:00")).toBe(1440);
    expect(hhmmToMinutes("24:01")).toBeNull();
    expect(hhmmToMinutes("12:60")).toBeNull();
    expect(hhmmToMinutes("ora 9")).toBeNull();
  });
});
