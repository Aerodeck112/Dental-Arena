import type { PriceUnit } from "@/generated/prisma/enums";
import { utcToLocal } from "./time";

/**
 * Romanian display formatting (docs/architecture.md §0.3, design-system.md §4.3 and §12.5).
 * Pure and client-safe.
 *
 * Typography: a no-break space (U+00A0) joins a number to „lei” and the groups of a phone
 * number, so neither ever wraps.
 */

export const NBSP = " ";

const leiInteger = new Intl.NumberFormat("ro-RO", { useGrouping: "always", maximumFractionDigits: 0 });
const leiDecimal = new Intl.NumberFormat("ro-RO", {
  useGrouping: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 220000 bani → „2.200”; 120050 → „1.200,50”. */
export function formatAmount(bani: number): string {
  const lei = bani / 100;
  return Number.isInteger(lei) ? leiInteger.format(lei) : leiDecimal.format(lei);
}

const UNIT_SUFFIX: Partial<Record<PriceUnit, string>> = {
  ORA: "oră",
  SEDINTA: "ședință",
};

/**
 * Price display:
 * - `formatLei(220000)` → „2.200 lei”
 * - `formatLei(20000, { from: true })` → „de la 200 lei”
 * - `formatLei(90000, { max: 110000 })` → „900 / 1.100 lei”
 * - `formatLei(15000, { unit: "ORA" })` → „150 lei / oră”
 * - `formatLei(null)` → „Prețul îl aflați la telefon”
 */
export function formatLei(
  bani: number | null,
  o: { from?: boolean; max?: number | null; unit?: PriceUnit } = {},
): string {
  if (bani === null || bani === undefined) return "Prețul îl aflați la telefon";
  const amount =
    o.max !== null && o.max !== undefined && o.max !== bani
      ? `${formatAmount(bani)} / ${formatAmount(o.max)}`
      : formatAmount(bani);
  const suffix = o.unit && UNIT_SUFFIX[o.unit] ? ` / ${UNIT_SUFFIX[o.unit]}` : "";
  return `${o.from ? "de la " : ""}${amount}${NBSP}lei${suffix}`;
}

const WEEKDAYS = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"];
const WEEKDAYS_SHORT = ["lun.", "mar.", "mie.", "joi", "vin.", "sâm.", "dum."];
const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];
const MONTHS_SHORT = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

/** A `Date` (shown in clinic time) or a `YYYY-MM-DD` local date, as local date parts. */
function localParts(d: Date | string): { y: number; m: number; day: number; weekday: number } {
  let dateISO: string;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    dateISO = d;
  } else {
    const date = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) throw new RangeError("Dată invalidă.");
    dateISO = utcToLocal(date).dateISO;
  }
  const [y, m, day] = dateISO.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return { y, m, day, weekday: wd === 0 ? 7 : wd };
}

/**
 * - "long": „marți, 7 octombrie”
 * - "short": „07.10.2026”
 * - "weekday": „mar. 7 oct.”
 * - "full": „marți, 7 octombrie 2026”
 */
export function formatDateRo(d: Date | string, style: "long" | "short" | "weekday" | "full" = "long"): string {
  const p = localParts(d);
  switch (style) {
    case "short":
      return `${String(p.day).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
    case "weekday":
      return `${WEEKDAYS_SHORT[p.weekday - 1]} ${p.day} ${MONTHS_SHORT[p.m - 1]}`;
    case "full":
      return `${WEEKDAYS[p.weekday - 1]}, ${p.day} ${MONTHS[p.m - 1]} ${p.y}`;
    default:
      return `${WEEKDAYS[p.weekday - 1]}, ${p.day} ${MONTHS[p.m - 1]}`;
  }
}

/** Capitalises the first letter, for page titles: „Marți, 6 octombrie”. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("ro-RO") + s.slice(1);
}

/** „09:30”, in clinic time. */
export function formatTime(d: Date): string {
  const { minute } = utcToLocal(d);
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** „07.10.2026, 09:30”, in clinic time. */
export function formatDateTime(d: Date): string {
  return `${formatDateRo(d, "short")}, ${formatTime(d)}`;
}

/** Romanian national digits ("0744123456") of an E.164 or local number; null when not Romanian. */
function nationalDigits(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+40")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("0040")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("+")) return null;
  else if (digits.startsWith("40") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

/** „0744 123 456”, „0265 326 316” (no-break spaces). Foreign numbers are returned as given. */
export function formatPhone(e164OrLocal: string): string {
  const national = nationalDigits(e164OrLocal);
  if (!national) return e164OrLocal.trim();
  return [national.slice(0, 4), national.slice(4, 7), national.slice(7)].join(NBSP);
}

/** „tel:+40265326316”. */
export function telHref(phone: string): string {
  const national = nationalDigits(phone);
  if (national) return `tel:+40${national.slice(1)}`;
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Masked CNP: „1••••••••••23” from the full CNP, or „•••••••••••23” from the last two digits only.
 */
export function maskCnp(last2: string): string {
  const s = last2.trim();
  if (s.length === 13) return `${s[0]}${"•".repeat(10)}${s.slice(-2)}`;
  return `${"•".repeat(11)}${s.slice(-2)}`;
}

/** „Maria Suciu”. */
export function personName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ").trim();
}

/** Age in whole years on the local date of `now`. */
export function ageFromBirthDate(d: Date, now: Date = new Date()): number {
  const birth = utcToLocal(d).dateISO.split("-").map(Number);
  const today = utcToLocal(now).dateISO.split("-").map(Number);
  let age = today[0] - birth[0];
  if (today[1] < birth[1] || (today[1] === birth[1] && today[2] < birth[2])) age -= 1;
  return Math.max(0, age);
}

/** „1 an”, „7 ani”, „21 de ani” (Romanian numeral agreement). */
export function formatYears(n: number): string {
  if (n === 1) return "1 an";
  const rest = n % 100;
  return n === 0 || (rest >= 1 && rest <= 19) ? `${n} ani` : `${n} de ani`;
}

/** Romanian plural agreement for counts: „1 programare”, „3 programări”, „20 de programări”. */
export function pluralRo(n: number, one: string, few: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return n === 0 || (rest >= 1 && rest <= 19) ? `${n} ${few}` : `${n} de ${few}`;
}
