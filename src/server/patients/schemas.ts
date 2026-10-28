import { z } from "zod";
import {
  optionalField,
  zCheckbox,
  zCnp,
  zDateISO,
  zId,
  zLei,
  zOptionalEmail,
  zOptionalText,
  zPhoneRo,
  zText,
  zToothFdi,
} from "@/lib/validation/common";

/**
 * zod schemas of the patient file (WP7). Pure and client-safe. Limits follow
 * docs/architecture.md §8.3: names 80, notes 5000.
 */

export const SEX_VALUES = ["F", "M"] as const;
export const COMFORT_VALUES = ["FARA_EMOTII", "EMOTII", "FRICA"] as const;
export const LEAD_SOURCE_VALUES = [
  "FORMULAR_CONTACT",
  "PROGRAMARE_ONLINE",
  "APEL_INVERS",
  "TELEFON",
  "RECOMANDARE",
  "SOCIAL",
  "ALT",
] as const;
export const CONSENT_TYPE_VALUES = [
  "GDPR_DATE_SANATATE",
  "TRATAMENT",
  "INHALOSEDARE",
  "SMS",
  "EMAIL",
  "MARKETING",
  "FOTO",
] as const;
export const CONSENT_METHOD_VALUES = ["FORMULAR_ONLINE", "SEMNAT_HARTIE", "SEMNAT_TABLETA", "VERBAL"] as const;
export const TOOTH_CONDITION_VALUES = [
  "CARIE",
  "OBTURATIE",
  "ENDODONTIE",
  "COROANA",
  "PUNTE",
  "IMPLANT",
  "EXTRAS",
  "LIPSA",
  "FRACTURA",
  "RADACINA_RESTANTA",
  "FATETA",
  "SIGILARE",
  "MOBILITATE",
  "PARODONTOPATIE",
  "PROTEZA",
  "INCLUS",
  "ALTA",
] as const;
export const PLAN_STATUS_VALUES = ["CIORNA", "PREZENTAT", "ACCEPTAT", "IN_CURS", "FINALIZAT", "RESPINS", "ANULAT"] as const;
export const PLAN_ITEM_STATUS_VALUES = ["PROPUS", "ACCEPTAT", "PROGRAMAT", "EFECTUAT", "ANULAT"] as const;
export const DOCUMENT_KIND_VALUES = [
  "RADIOGRAFIE_PANORAMICA",
  "RADIOGRAFIE_RETROALVEOLARA",
  "CBCT",
  "FOTOGRAFIE",
  "CONSIMTAMANT",
  "DEVIZ",
  "SCRISOARE_MEDICALA",
  "ALT",
] as const;
export const DATA_REQUEST_TYPE_VALUES = ["ACCES", "EXPORT", "RECTIFICARE", "STERGERE", "OPOZITIE"] as const;
export const DATA_REQUEST_STATUS_VALUES = ["PRIMITA", "IN_LUCRU", "FINALIZATA", "RESPINSA"] as const;

const NAME_MAX = 80;
const NOTE_MAX = 5000;

const choose = (message: string) => ({ error: message });

/** Birth date: a real past date, not before 1900. */
const zBirthDate = zDateISO.refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), {
  error: "Introduceți o dată a nașterii din trecut.",
});

/** Surfaces „MOD”, „mo”, „V” → canonical order M O D V L P, no repeats. L and P are the same face. */
export const SURFACE_ORDER = ["M", "O", "D", "V", "L", "P"] as const;
export function normalizeSurfaces(input: string | string[] | undefined | null): string | undefined {
  if (input === undefined || input === null) return undefined;
  const raw = (Array.isArray(input) ? input.join("") : input).toUpperCase().replace(/[^MODVLP]/g, "");
  const set = new Set(raw.split(""));
  const out = SURFACE_ORDER.filter((s) => set.has(s)).join("");
  return out === "" ? undefined : out;
}
const zSurfaces = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => normalizeSurfaces(v));

const patientFields = {
  firstName: zText(NAME_MAX),
  lastName: zText(NAME_MAX),
  phone: optionalField(zPhoneRo),
  email: zOptionalEmail,
  birthDate: optionalField(zBirthDate),
  sex: optionalField(z.enum(SEX_VALUES, choose("Alegeți sexul."))),
  guardianId: optionalField(zId),
  preferredLocationId: optionalField(zId),
  primaryDoctorId: optionalField(zId),
  comfortDefault: optionalField(z.enum(COMFORT_VALUES, choose("Alegeți o variantă."))),
  smsOptIn: zCheckbox,
  emailOptIn: zCheckbox,
  acquisitionSource: optionalField(z.enum(LEAD_SOURCE_VALUES, choose("Alegeți o sursă."))),
};

/** „Pacient nou”. `confirmDuplicate` is set when the user saw the duplicate warning and continues. */
export const patientCreateSchema = z.object({
  ...patientFields,
  cnp: optionalField(zCnp),
  prefersSedation: zCheckbox,
  notes: zOptionalText(NOTE_MAX),
  confirmDuplicate: zCheckbox,
});
export type PatientCreateForm = z.output<typeof patientCreateSchema>;

/** „Date personale”. The stored CNP is kept unless `cnpAction` is „set” (new value) or „clear”. */
export const patientUpdateSchema = z.object({
  id: zId,
  ...patientFields,
  street: zOptionalText(160),
  city: zOptionalText(NAME_MAX),
  county: zOptionalText(NAME_MAX),
  prefersSedation: zCheckbox,
  notes: zOptionalText(NOTE_MAX),
  cnpAction: z.enum(["keep", "set", "clear"]).default("keep"),
  cnp: optionalField(zCnp),
  expectedUpdatedAt: z.string().optional(),
});
export type PatientUpdateForm = z.output<typeof patientUpdateSchema>;

/** Live duplicate check while typing in „Pacient nou”. Everything optional and lenient. */
export const duplicateQuerySchema = z.object({
  phone: z.string().max(40).optional(),
  email: z.string().max(254).optional(),
  firstName: z.string().max(NAME_MAX).optional(),
  lastName: z.string().max(NAME_MAX).optional(),
  birthDate: z.string().max(10).optional(),
  cnp: z.string().max(20).optional(),
  excludeId: z.string().max(40).optional(),
});

export const comfortSchema = z.object({
  id: zId,
  comfortDefault: optionalField(z.enum(COMFORT_VALUES, choose("Alegeți o variantă."))),
  prefersSedation: zCheckbox,
});

export const tagsSchema = z.object({
  id: zId,
  tagIds: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(zId).max(30)),
  newTag: zOptionalText(40),
});

export const medicalHistorySchema = z.object({
  id: zId,
  allergies: zOptionalText(500),
  medications: zOptionalText(1000),
  anticoagulants: zCheckbox,
  cardiacDisease: zCheckbox,
  hypertension: zCheckbox,
  diabetes: zCheckbox,
  asthma: zCheckbox,
  epilepsy: zCheckbox,
  hepatitis: zCheckbox,
  hiv: zCheckbox,
  bleedingDisorder: zCheckbox,
  bisphosphonates: zCheckbox,
  pregnancy: zCheckbox,
  smoker: zCheckbox,
  otherConditions: zOptionalText(2000),
});
export type MedicalHistoryForm = z.output<typeof medicalHistorySchema>;

export const consentRecordSchema = z.object({
  id: zId,
  type: z.enum(CONSENT_TYPE_VALUES, choose("Alegeți tipul consimțământului.")),
  granted: z.enum(["da", "nu"], choose("Alegeți dacă pacientul și-a dat acordul.")).transform((v) => v === "da"),
  method: z.enum(CONSENT_METHOD_VALUES, choose("Alegeți cum a fost exprimat acordul.")),
  textVersion: zText(60),
  documentId: optionalField(zId),
  treatmentPlanId: optionalField(zId),
  notes: zOptionalText(1000),
});
export type ConsentRecordForm = z.output<typeof consentRecordSchema>;

export const consentRevokeSchema = z.object({ id: zId, consentId: zId });

export const toothConditionSchema = z.object({
  id: zId,
  tooth: zToothFdi,
  condition: z.enum(TOOTH_CONDITION_VALUES, choose("Alegeți constatarea.")),
  surfaces: zSurfaces,
  notes: zOptionalText(500),
  /** When set, the previous active rows of this tooth are resolved (caria devine obturație). */
  replaceExisting: zCheckbox,
});
export type ToothConditionForm = z.output<typeof toothConditionSchema>;

export const toothConditionResolveSchema = z.object({ id: zId, conditionId: zId });

export const toothPlanItemSchema = z.object({
  id: zId,
  tooth: zToothFdi,
  serviceId: zId,
  surfaces: zSurfaces,
  /** Existing draft plan to add to; empty creates „Plan de tratament” in CIORNA. */
  planId: optionalField(zId),
});

export const planCreateSchema = z.object({
  id: zId,
  title: zText(120),
  doctorId: optionalField(zId),
  notes: zOptionalText(NOTE_MAX),
});

export const planUpdateSchema = z.object({
  id: zId,
  planId: zId,
  title: zText(120),
  doctorId: optionalField(zId),
  notes: zOptionalText(NOTE_MAX),
  discount: z.preprocess((v) => (v === undefined || v === "" ? 0 : v), zLei),
});

export const planStatusSchema = z.object({
  id: zId,
  planId: zId,
  status: z.enum(PLAN_STATUS_VALUES, choose("Alegeți statusul.")),
});

export const planItemSchema = z.object({
  id: zId,
  planId: zId,
  itemId: optionalField(zId),
  serviceId: optionalField(zId),
  description: zOptionalText(200),
  tooth: optionalField(zToothFdi),
  surfaces: zSurfaces,
  phase: z.coerce.number({ error: "Alegeți faza." }).int().min(1, { error: "Faza începe de la 1." }).max(9, { error: "Cel mult 9 faze." }),
  quantity: z.coerce
    .number({ error: "Introduceți cantitatea." })
    .int({ error: "Cantitatea este un număr întreg." })
    .min(1, { error: "Cantitatea este cel puțin 1." })
    .max(99, { error: "Cantitatea este cel mult 99." }),
  /** Empty: copied from the catalog. */
  unitPrice: optionalField(zLei),
  discount: z.preprocess((v) => (v === undefined || v === "" ? 0 : v), zLei),
});
export type PlanItemForm = z.output<typeof planItemSchema>;

export const planItemStatusSchema = z.object({
  id: zId,
  planId: zId,
  itemId: zId,
  status: z.enum(PLAN_ITEM_STATUS_VALUES, choose("Alegeți statusul.")),
});

export const planItemDeleteSchema = z.object({ id: zId, planId: zId, itemId: zId });

export const noteSchema = z.object({
  id: zId,
  body: zText(NOTE_MAX),
  clinical: zCheckbox,
  pinned: zCheckbox,
});

export const noteUpdateSchema = z.object({ id: zId, noteId: zId, body: zText(NOTE_MAX) });
export const notePinSchema = z.object({ id: zId, noteId: zId, pinned: zCheckbox });
export const noteDeleteSchema = z.object({ id: zId, noteId: zId });

export const documentMetaSchema = z.object({
  kind: z.enum(DOCUMENT_KIND_VALUES, choose("Alegeți tipul documentului.")),
  title: zOptionalText(160),
  tooth: optionalField(zToothFdi),
  takenAt: optionalField(zDateISO),
});

export const documentDeleteSchema = z.object({ id: zId, documentId: zId });

export const anonymizeSchema = z.object({
  id: zId,
  confirmFileNumber: z.coerce.number({ error: "Introduceți numărul fișei." }).int(),
});

export const dataRequestCreateSchema = z.object({
  patientId: optionalField(zId),
  type: z.enum(DATA_REQUEST_TYPE_VALUES, choose("Alegeți tipul cererii.")),
  requesterName: zText(NAME_MAX * 2),
  contact: zOptionalText(160),
  details: zOptionalText(2000),
  receivedAt: optionalField(zDateISO),
});

export const dataRequestUpdateSchema = z.object({
  requestId: zId,
  status: z.enum(DATA_REQUEST_STATUS_VALUES, choose("Alegeți statusul.")),
  outcome: zOptionalText(2000),
});

export const cnpRevealSchema = z.object({ id: zId });
