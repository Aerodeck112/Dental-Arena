/**
 * Clinic time (docs/architecture.md §0.3). Pure and client-safe; there is no date library.
 *
 * - Instants are `Date` (UTC).
 * - Schedule times are minutes after local midnight in Europe/Bucharest (540 = 09:00).
 * - Calendar days are ISO local dates, `YYYY-MM-DD`.
 * - Conversions go through `Intl`, so they are DST-safe (the 25 Oct 2026 change included).
 */

export const CLINIC_TZ = "Europe/Bucharest";

const MINUTE_MS = 60_000;
const DAY_MINUTES = 1440;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallClock(d: Date): WallClock {
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of the clinic time zone at instant `d`, in minutes (local − UTC): 120 in winter, 180 in summer. */
export function clinicOffsetMinutes(d: Date): number {
  const w = wallClock(d);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - d.getTime()) / MINUTE_MS);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDateISO(dateISO: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(dateISO);
  if (!match) throw new RangeError(`Dată invalidă: ${dateISO}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Dată invalidă: ${dateISO}`);
  }
  return { y, m, d };
}

function formatUtcDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isValidDateISO(dateISO: string): boolean {
  try {
    parseDateISO(dateISO);
    return true;
  } catch {
    return false;
  }
}

/**
 * The UTC instant of a local wall-clock time. `minuteOfDay` may be 0–1440 (1440 = next midnight).
 * A time inside the spring-forward gap maps to the hour after it.
 */
export function localToUtc(dateISO: string, minuteOfDay: number): Date {
  const { y, m, d } = parseDateISO(dateISO);
  const wall = Date.UTC(y, m - 1, d) + minuteOfDay * MINUTE_MS;
  const firstGuess = wall - clinicOffsetMinutes(new Date(wall)) * MINUTE_MS;
  const offset = clinicOffsetMinutes(new Date(firstGuess));
  return new Date(wall - offset * MINUTE_MS);
}

/** Local date, minute of day and ISO weekday (1 = Monday … 7 = Sunday) of an instant. */
export function utcToLocal(d: Date): { dateISO: string; minute: number; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 } {
  const w = wallClock(d);
  const dateISO = `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
  return { dateISO, minute: w.hour * 60 + w.minute, weekday: isoWeekday(dateISO) };
}

/** `[start, end)` of a local calendar day in UTC. 23 or 25 hours long on DST days. */
export function localDayRangeUtc(dateISO: string): { start: Date; end: Date } {
  return { start: localToUtc(dateISO, 0), end: localToUtc(addDaysISO(dateISO, 1), 0) };
}

/** Today's local date in the clinic time zone. */
export function todayISO(now: Date = new Date()): string {
  return utcToLocal(now).dateISO;
}

export function addDaysISO(dateISO: string, n: number): string {
  const { y, m, d } = parseDateISO(dateISO);
  return formatUtcDate(Date.UTC(y, m - 1, d + n));
}

/** Adds calendar months, clamping to the last day of the target month (31 Jan + 1 → 28/29 Feb). */
export function addMonthsISO(dateISO: string, n: number): string {
  const { y, m, d } = parseDateISO(dateISO);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return formatUtcDate(Date.UTC(y, m - 1 + n, Math.min(d, lastDay)));
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDaysISO(a: string, b: string): number {
  const pa = parseDateISO(a);
  const pb = parseDateISO(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / (DAY_MINUTES * MINUTE_MS));
}

export function isoWeekday(dateISO: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const { y, m, d } = parseDateISO(dateISO);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (wd === 0 ? 7 : wd) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** The Monday of the week containing `dateISO`. */
export function startOfWeekISO(dateISO: string): string {
  return addDaysISO(dateISO, 1 - isoWeekday(dateISO));
}

/** 570 → "09:30"; 1440 → "24:00". */
export function minutesToHHMM(m: number): string {
  const total = Math.max(0, Math.min(DAY_MINUTES, Math.round(m)));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** "09:30" or "9:30" → 570; "24:00" → 1440. Returns null for anything else. */
export function hhmmToMinutes(s: string): number | null {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** `[start, end)` of a local calendar month in UTC. */
export function monthRangeUtc(year: number, month1to12: number): { start: Date; end: Date } {
  const first = `${year}-${pad2(month1to12)}-01`;
  return { start: localToUtc(first, 0), end: localToUtc(addMonthsISO(first, 1), 0) };
}
