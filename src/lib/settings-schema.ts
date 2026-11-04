import { z } from "zod";

/**
 * Settings keys, zod schemas and defaults (docs/architecture.md §7.4). Pure: the settings
 * forms (client) and the seed import it; `src/lib/settings.ts` reads and writes the rows.
 */

const minute = z.number().int().min(0).max(1440);
const optionalUrl = z.string().trim().url("Introduceți o adresă completă, de exemplu https://…").nullable();

export const clinicSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  legalName: z.string().trim().min(1).max(200),
  cui: z.string().trim().min(1).max(40),
  regCom: z.string().trim().min(1).max(60),
  registeredAddress: z.string().trim().min(1).max(300),
  email: z.string().trim().toLowerCase().email("Introduceți o adresă de e-mail validă."),
  iban: z.string().trim().max(40).nullable(),
  bank: z.string().trim().max(120).nullable(),
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  foundedYear: z.number().int().min(1990).max(2100),
  dpoEmail: z.string().trim().toLowerCase().email("Introduceți o adresă de e-mail validă."),
});

export const bookingSettingsSchema = z.object({
  slotStepMinutes: z.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Pasul trebuie să fie 5, 10, 15, 20, 30 sau 60 de minute."),
  minLeadMinutes: z.number().int().min(0).max(7 * 1440),
  horizonDays: z.number().int().min(1).max(365),
  maxDaysPerRequest: z.number().int().min(1).max(14),
  bufferMinutes: z.number().int().min(0).max(120),
  cancelCutoffHours: z.number().int().min(0).max(72),
  morningEndsAtMinute: minute,
  homeServiceCode: z.string().trim().min(1).max(40),
  unsureServiceCode: z.string().trim().min(1).max(40),
  onlineEnabled: z.boolean(),
});

export const remindersSettingsSchema = z.object({
  enabled: z.boolean(),
  hoursBefore: z.number().int().min(2).max(72),
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  quietStartMinute: minute,
  quietEndMinute: minute,
  smsStripDiacritics: z.boolean(),
});

export const invoicingSettingsSchema = z.object({
  invoiceSeries: z.string().trim().regex(/^[A-Z]{1,8}$/, "Seria are doar majuscule, de exemplu DA."),
  receiptSeries: z.string().trim().regex(/^[A-Z]{1,8}$/, "Seria are doar majuscule, de exemplu DAC."),
  defaultVatRate: z.number().int().min(0).max(100),
  vatExemptionNote: z.string().trim().max(300),
  paymentTermDays: z.number().int().min(0).max(365),
});

export const gdprSettingsSchema = z.object({
  consentTextVersion: z.string().trim().min(1).max(60),
  leadRetentionDays: z.number().int().min(30).max(3650),
  messageBodyRetentionDays: z.number().int().min(30).max(3650),
});

export const uiSettingsSchema = z.object({
  defaultDensity: z.enum(["COMPACT", "CONFORTABIL"]),
});

export const SETTINGS_SCHEMAS = {
  clinic: clinicSettingsSchema,
  booking: bookingSettingsSchema,
  reminders: remindersSettingsSchema,
  invoicing: invoicingSettingsSchema,
  gdpr: gdprSettingsSchema,
  ui: uiSettingsSchema,
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsMap = { [K in SettingKey]: z.output<(typeof SETTINGS_SCHEMAS)[K]> };

export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMAS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMAS, key);
}

export const SETTINGS_DEFAULTS: SettingsMap = {
  clinic: {
    displayName: "Dental Arena Clinic",
    legalName: "[de completat]",
    cui: "[de completat]",
    regCom: "[de completat]",
    registeredAddress: "[de completat]",
    email: "office@dentalarena.ro",
    iban: null,
    bank: null,
    facebookUrl: "https://www.facebook.com/www.dentalarena.ro",
    instagramUrl: "https://www.instagram.com/clinicadentalarena/",
    foundedYear: 2009,
    dpoEmail: "office@dentalarena.ro",
  },
  booking: {
    slotStepMinutes: 15,
    minLeadMinutes: 120,
    horizonDays: 30,
    maxDaysPerRequest: 14,
    bufferMinutes: 0,
    cancelCutoffHours: 2,
    morningEndsAtMinute: 780,
    homeServiceCode: "CON-CONSULT",
    unsureServiceCode: "CON-CONSULT",
    onlineEnabled: true,
  },
  reminders: {
    enabled: true,
    hoursBefore: 24,
    smsEnabled: true,
    emailEnabled: true,
    quietStartMinute: 1260,
    quietEndMinute: 480,
    smsStripDiacritics: true,
  },
  invoicing: {
    invoiceSeries: "DA",
    receiptSeries: "DAC",
    defaultVatRate: 0,
    vatExemptionNote: "Scutit de TVA conform art. 292 alin. (1) lit. a) din Codul fiscal",
    paymentTermDays: 0,
  },
  gdpr: {
    consentTextVersion: "gdpr-2026-10",
    leadRetentionDays: 180,
    messageBodyRetentionDays: 365,
  },
  ui: {
    defaultDensity: "COMPACT",
  },
};

/** Romanian titles of the settings groups, for the Setări page. */
export const SETTING_KEY_LABEL: Record<SettingKey, string> = {
  clinic: "Datele clinicii",
  booking: "Programări online",
  reminders: "Reamintiri",
  invoicing: "Facturare",
  gdpr: "GDPR și păstrarea datelor",
  ui: "Aspect",
};

/**
 * Merges a stored JSON value over the defaults and validates it. A stored value that no longer
 * validates (for example after a schema change) falls back to the defaults, field by field.
 */
export function mergeSettings<K extends SettingKey>(key: K, stored: unknown): SettingsMap[K] {
  const defaults = SETTINGS_DEFAULTS[key];
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;
  const schema = SETTINGS_SCHEMAS[key] as unknown as z.ZodObject;
  const merged: Record<string, unknown> = { ...defaults };
  for (const [field, value] of Object.entries(stored as Record<string, unknown>)) {
    if (!(field in defaults)) continue;
    const fieldSchema = schema.shape[field] as z.ZodType | undefined;
    if (fieldSchema?.safeParse(value).success) merged[field] = value;
  }
  const parsed = SETTINGS_SCHEMAS[key].safeParse(merged);
  return parsed.success ? (parsed.data as SettingsMap[K]) : defaults;
}
