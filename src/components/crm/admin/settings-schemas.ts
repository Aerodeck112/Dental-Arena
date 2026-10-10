import { z } from "zod";
import type { SettingKey, SettingsMap } from "@/lib/settings-schema";
import { zCheckbox, zEmail, zTimeHHMM } from "@/lib/validation/common";

/**
 * Form schemas for Setări (one per settings key, docs/architecture.md §7.4). Pure and client-safe.
 * They turn the strings of a form into the typed value with Romanian messages; `saveSettings`
 * then validates the result again against the strict key schema before storing it.
 */

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const int = (min: number, max: number, what: string) =>
  z.preprocess(
    blank,
    z.coerce
      .number({ error: `Completați ${what}, un număr întreg.` })
      .int(`Completați ${what}, un număr întreg.`)
      .min(min, `${capital(what)} este între ${min} și ${max}.`)
      .max(max, `${capital(what)} este între ${min} și ${max}.`),
  );

const text = (max: number, what: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, `Completați ${what}.`).max(max, `${capital(what)} are cel mult ${max} de caractere.`),
  );

const nullableText = (max: number, what: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().max(max, `${capital(what)} are cel mult ${max} de caractere.`).nullable(),
  );

const nullableUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().url("Introduceți o adresă completă, de exemplu https://…").max(300).nullable(),
);

const series = (example: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z.string().regex(/^[A-Z]{1,8}$/, `Seria are 1–8 majuscule, de exemplu ${example}.`),
  );

/** Legal data the clinic has not supplied yet: blank keeps the „[de completat]” placeholder. */
const legalText = (max: number, what: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : "[de completat]"),
    z.string().max(max, `${capital(what)} are cel mult ${max} de caractere.`),
  );

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const SETTINGS_FORM_SCHEMAS = {
  clinic: z.object({
    displayName: text(120, "numele afișat"),
    legalName: legalText(200, "denumirea legală"),
    cui: legalText(40, "CUI-ul"),
    regCom: legalText(60, "numărul de la Registrul Comerțului"),
    registeredAddress: legalText(300, "sediul social"),
    email: zEmail,
    iban: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v.replace(/\s+/g, "").toUpperCase() : null),
      z.string().regex(/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/, "IBAN-ul românesc are 24 de caractere, de exemplu RO49AAAA1B31007593840000.").nullable(),
    ),
    bank: nullableText(120, "banca"),
    facebookUrl: nullableUrl,
    instagramUrl: nullableUrl,
    foundedYear: int(1990, 2100, "anul înființării"),
    dpoEmail: zEmail,
  }),
  booking: z.object({
    slotStepMinutes: z.coerce
      .number({ error: "Alegeți pasul." })
      .refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Pasul trebuie să fie 5, 10, 15, 20, 30 sau 60 de minute."),
    minLeadMinutes: int(0, 7 * 1440, "timpul minim până la programare"),
    horizonDays: int(1, 365, "orizontul de programare"),
    maxDaysPerRequest: int(1, 14, "numărul de zile afișate odată"),
    bufferMinutes: int(0, 120, "pauza dintre programări"),
    cancelCutoffHours: int(0, 72, "termenul de anulare"),
    morningEndsAtMinute: zTimeHHMM,
    homeServiceCode: text(40, "serviciul implicit"),
    unsureServiceCode: text(40, "serviciul pentru „Nu știu”"),
    onlineEnabled: zCheckbox,
  }),
  reminders: z.object({
    enabled: zCheckbox,
    hoursBefore: int(2, 72, "numărul de ore înainte"),
    smsEnabled: zCheckbox,
    emailEnabled: zCheckbox,
    quietStartMinute: zTimeHHMM,
    quietEndMinute: zTimeHHMM,
    smsStripDiacritics: zCheckbox,
  }),
  invoicing: z.object({
    invoiceSeries: series("DA"),
    receiptSeries: series("DAC"),
    defaultVatRate: int(0, 100, "cota TVA"),
    vatExemptionNote: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(300, "Mențiunea are cel mult 300 de caractere.")),
    paymentTermDays: int(0, 365, "termenul de plată"),
  }),
  gdpr: z.object({
    consentTextVersion: text(60, "versiunea textului de consimțământ"),
    leadRetentionDays: int(30, 3650, "păstrarea cererilor"),
    messageBodyRetentionDays: int(30, 3650, "păstrarea textului mesajelor"),
  }),
  ui: z.object({
    defaultDensity: z.enum(["COMPACT", "CONFORTABIL"], { error: "Alegeți densitatea." }),
  }),
} satisfies { [K in SettingKey]: z.ZodType<SettingsMap[K], unknown> };
