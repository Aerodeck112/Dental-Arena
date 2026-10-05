import { z } from "zod";
import { hhmmToMinutes, isValidDateISO } from "../time";

/**
 * Shared zod building blocks (docs/architecture.md §7.2, §8.3). Pure and client-safe.
 * Messages follow design system §12.4: say what happened and what to do.
 */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// ───────────────────────────── Identifiers ─────────────────────────────

/** A Prisma `cuid()` id. */
export const zId: z.ZodString = z
  .string({ error: "Identificator lipsă." })
  .trim()
  .regex(/^[a-z0-9]{20,40}$/i, { error: "Identificator invalid." });

// ───────────────────────────── Text ─────────────────────────────

// Control characters except tab (\t) and newline (\n); \r is normalised away.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** „cel mult 10 caractere”, „cel mult 80 de caractere” (Romanian numeral agreement). */
function tooLong(max: number): string {
  const rest = max % 100;
  const de = rest === 0 || rest >= 20 ? "de " : "";
  return `Textul este prea lung: cel mult ${max} ${de}caractere.`;
}

function cleanText(v: string): string {
  return v.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").trim();
}

/** Required text: trimmed, control characters stripped, at most `max` characters. */
export const zText = (max: number): z.ZodType<string> =>
  z.preprocess(
    (v) => (typeof v === "string" ? cleanText(v) : v),
    z
      .string({ error: "Completați acest câmp." })
      .min(1, { error: "Completați acest câmp." })
      .max(max, { error: tooLong(max) }),
  );

/** Optional text: empty becomes undefined. */
export const zOptionalText = (max: number): z.ZodType<string | undefined> =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v ?? undefined;
      const cleaned = cleanText(v);
      return cleaned === "" ? undefined : cleaned;
    },
    z.string().max(max, { error: tooLong(max) }).optional(),
  );

// ───────────────────────────── Contact ─────────────────────────────

const PHONE_MESSAGE = "Introduceți un număr de telefon, de exemplu 0745 123 456.";

/**
 * Normalises a phone number to E.164. Romanian numbers: „0744 123 456”, „0744123456”,
 * „+40 744 123 456”, „0040744123456”, „0265.326.316” → „+40744123456”.
 * Foreign numbers must start with „+” or „00”. Returns null when the number is not valid.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!/^[+\d][\d\s.\-()/]*$/.test(raw)) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+40")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("40") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (digits.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
  }
  // Romanian national format: 0 + 9 digits; landlines 02x/03x, mobiles 07x, special 08x.
  if (/^0[2378]\d{8}$/.test(digits)) return `+40${digits.slice(1)}`;
  return null;
}

export const zPhoneRo: z.ZodType<string> = z
  .string({ error: PHONE_MESSAGE })
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return phone;
  });

const EMAIL_MESSAGE = "Introduceți o adresă de e-mail validă, de exemplu nume@exemplu.ro.";

export const zEmail: z.ZodType<string> = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.string({ error: EMAIL_MESSAGE }).max(254, { error: EMAIL_MESSAGE }).pipe(z.email({ error: EMAIL_MESSAGE })),
);

export const zOptionalEmail: z.ZodType<string | undefined> = z.preprocess(blankToUndefined, zEmail.optional());

// ───────────────────────────── CNP ─────────────────────────────

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/** Control digit of the first 12 digits of a CNP. */
export function cnpControlDigit(first12: string): number {
  const sum = CNP_WEIGHTS.reduce((acc, w, i) => acc + w * Number(first12[i]), 0);
  const rest = sum % 11;
  return rest === 10 ? 1 : rest;
}

/** Full CNP check: 13 digits, valid sex/century digit, real birth date, county code, control digit. */
export function isValidCnp(cnp: string): boolean {
  if (!/^\d{13}$/.test(cnp)) return false;
  const s = Number(cnp[0]);
  if (s === 0) return false;
  const yy = Number(cnp.slice(1, 3));
  const mm = Number(cnp.slice(3, 5));
  const dd = Number(cnp.slice(5, 7));
  const centuries = s === 1 || s === 2 ? [1900] : s === 3 || s === 4 ? [1800] : s === 5 || s === 6 ? [2000] : [1900, 2000];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (!centuries.some((c) => isValidDateISO(`${c + yy}-${pad(mm)}-${pad(dd)}`))) return false;
  const county = Number(cnp.slice(7, 9));
  if (!((county >= 1 && county <= 52) || county === 70)) return false;
  return cnpControlDigit(cnp.slice(0, 12)) === Number(cnp[12]);
}

export const zCnp: z.ZodType<string> = z
  .string({ error: "CNP-ul nu este valid." })
  .transform((v) => v.replace(/\s/g, ""))
  .refine(isValidCnp, { error: "CNP-ul nu este valid." });

// ───────────────────────────── Money ─────────────────────────────

const LEI_MESSAGE = "Introduceți o sumă, de exemplu 1.200 sau 1.200,50.";

/**
 * Parses a lei amount into bani: "1.200,50" → 120050, "1200" → 120000, "1.200" → 120000,
 * "12.5" → 1250, 1200 → 120000. Returns null for anything else or a negative amount.
 */
export function parseLei(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  let s = input.replace(/\s| /g, "").replace(/lei$/i, "");
  if (s === "") return null;
  if (s.includes(",")) {
    // Romanian format: dots group thousands, the comma is the decimal separator.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(s)) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return null;
  }
  const value = Number(s);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

export const zLei: z.ZodType<number> = z.union([z.string(), z.number()], { error: LEI_MESSAGE }).transform((v, ctx) => {
  const bani = parseLei(v);
  if (bani === null) {
    ctx.addIssue({ code: "custom", message: LEI_MESSAGE });
    return z.NEVER;
  }
  return bani;
});

// ───────────────────────────── Dates and times ─────────────────────────────

export const zDateISO: z.ZodType<string> = z
  .string({ error: "Introduceți o dată validă." })
  .trim()
  .refine(isValidDateISO, { error: "Introduceți o dată validă." });

export const zTimeHHMM: z.ZodType<number> = z.string({ error: "Introduceți ora, de exemplu 09:30." }).transform((v, ctx) => {
  const minutes = hhmmToMinutes(v);
  if (minutes === null) {
    ctx.addIssue({ code: "custom", message: "Introduceți ora, de exemplu 09:30." });
    return z.NEVER;
  }
  return minutes;
});

// ───────────────────────────── Teeth ─────────────────────────────

/** True for FDI tooth numbers: 11–18, 21–28, 31–38, 41–48 (permanent), 51–55 … 81–85 (deciduous). */
export function isFdiTooth(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  const quadrant = Math.floor(n / 10);
  const position = n % 10;
  if (quadrant >= 1 && quadrant <= 4) return position >= 1 && position <= 8;
  if (quadrant >= 5 && quadrant <= 8) return position >= 1 && position <= 5;
  return false;
}

export const zToothFdi: z.ZodType<number> = z.coerce
  .number({ error: "Alegeți un dinte valid (numerotare FDI, de exemplu 36)." })
  .refine(isFdiTooth, { error: "Alegeți un dinte valid (numerotare FDI, de exemplu 36)." });

// ───────────────────────────── Checkboxes ─────────────────────────────

/** "on" | "true" | "1" | true → true; absent, "", "false", "off", "0" → false. */
export const zCheckbox: z.ZodType<boolean> = z.preprocess((v) => {
  if (Array.isArray(v)) v = v[v.length - 1];
  if (v === true || v === "on" || v === "true" || v === "1" || v === 1) return true;
  return false;
}, z.boolean());

// ───────────────────────────── Helpers ─────────────────────────────

/** Makes any schema optional, treating "" as missing (for optional form fields). */
export function optionalField<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional());
}
