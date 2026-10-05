import { z } from "zod";
import { optionalField, zCheckbox, zId, zOptionalEmail, zOptionalText, zPhoneRo, zText } from "@/lib/validation/common";

/**
 * Public lead forms (docs/architecture.md §6.5, §7.3, §8.2–8.3). Pure zod and client-safe:
 * the booking wizard, the callback form and the WP3 contact form validate with the same schemas
 * the server actions use. The honeypot fields (`website`, `_ts`) are checked by `publicAction`
 * before these schemas run; unknown keys are stripped.
 *
 * Messages follow design system §12.4: say what happened and what to do.
 */

export const COMFORT_VALUES = ["FARA_EMOTII", "EMOTII", "FRICA"] as const;
export type ComfortValue = (typeof COMFORT_VALUES)[number];

/** URL / sessionStorage form of the comfort answer (`?confort=fara-emotii`). */
export const COMFORT_PARAM: Record<ComfortValue, string> = {
  FARA_EMOTII: "fara-emotii",
  EMOTII: "emotii",
  FRICA: "frica",
};

export function comfortFromParam(v: string | null | undefined): ComfortValue | null {
  if (!v) return null;
  const key = v.trim().toLowerCase();
  const hit = (Object.keys(COMFORT_PARAM) as ComfortValue[]).find((c) => COMFORT_PARAM[c] === key);
  if (hit) return hit;
  const upper = key.toUpperCase().replace(/-/g, "_");
  return (COMFORT_VALUES as readonly string[]).includes(upper) ? (upper as ComfortValue) : null;
}

export const LOCATION_SLUGS = ["cristesti", "ludus"] as const;
export type LocationSlug = (typeof LOCATION_SLUGS)[number];

const GDPR_REQUIRED = "Pentru a trimite cererea, avem nevoie de acordul dumneavoastră pentru prelucrarea datelor.";
const NAME_MESSAGE = "Scrieți numele și prenumele.";

const zName = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s+/g, " ") : v),
  zText(80).refine((v) => v.length >= 2, { error: NAME_MESSAGE }),
);

const zConsentRequired = zCheckbox.refine((v) => v === true, { error: GDPR_REQUIRED });

/** Optional relative path of the page the form was sent from (never a full URL). */
const zSourcePath = z.preprocess(
  (v) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v.slice(0, 200) : undefined),
  z.string().optional(),
);

/** A client-generated UUID (`crypto.randomUUID()` when the form mounts). */
const zIdempotencyKey = z
  .string({ error: "Reîncărcați pagina și încercați din nou." })
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    error: "Reîncărcați pagina și încercați din nou.",
  })
  .transform((v) => v.toLowerCase());

const zComfort = optionalField(z.enum(COMFORT_VALUES, { error: "Alegeți una dintre variante." }));

const zLocationSlug = optionalField(z.enum(LOCATION_SLUGS, { error: "Alegeți clinica: Cristești sau Luduș." }));

/** ISO instant (`2026-10-07T07:30:00.000Z`) → Date. */
const zInstant = z
  .string({ error: "Alegeți o oră." })
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v)), {
    error: "Alegeți o oră din listă.",
  })
  .transform((v) => new Date(v));

// ───────────────────────────── Contact (WP3 `/contact`) ─────────────────────────────

export const contactLeadSchema = z
  .object({
    name: zName,
    email: zOptionalEmail,
    phone: optionalField(zPhoneRo),
    message: zText(2000),
    /** Optional clinic the message is about. */
    location: zLocationSlug,
    consentGdpr: zConsentRequired,
    sourcePath: zSourcePath,
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Lăsați-ne un e-mail sau un număr de telefon, ca să vă putem răspunde.",
      });
    }
  });

export type ContactLeadInput = z.output<typeof contactLeadSchema>;

// ───────────────────────────── Online booking (`/programare`) ─────────────────────────────

export const onlineBookingSchema = z
  .object({
    serviceId: zId,
    locationId: zId,
    /** Absent = „Oricare medic”. */
    doctorId: optionalField(zId),
    startsAt: zInstant,
    comfort: zComfort,
    wantsSedation: zCheckbox,
    comfortNote: zOptionalText(500),
    name: zName,
    phone: zPhoneRo,
    email: zOptionalEmail,
    forWhom: z.preprocess((v) => v ?? "eu", z.enum(["eu", "copil"], { error: "Alegeți pentru cine este programarea." })),
    childFirstName: zOptionalText(60),
    childAge: optionalField(
      z.coerce
        .number({ error: "Scrieți vârsta copilului în ani, de exemplu 7." })
        .int({ error: "Scrieți vârsta copilului în ani, de exemplu 7." })
        .min(0, { error: "Scrieți vârsta copilului în ani, de exemplu 7." })
        .max(17, { error: "Pentru copii până la 17 ani. Pentru un adult, alegeți „Pentru mine” și scrieți numele lui." }),
    ),
    note: zOptionalText(2000),
    consentGdpr: zConsentRequired,
    consentSms: zCheckbox,
    idempotencyKey: zIdempotencyKey,
    sourcePath: zSourcePath,
  })
  .superRefine((v, ctx) => {
    if (v.forWhom === "copil") {
      if (!v.childFirstName) {
        ctx.addIssue({ code: "custom", path: ["childFirstName"], message: "Scrieți prenumele copilului." });
      }
      if (v.childAge === undefined) {
        ctx.addIssue({ code: "custom", path: ["childAge"], message: "Scrieți vârsta copilului în ani, de exemplu 7." });
      }
    }
  });

export type OnlineBookingInput = z.output<typeof onlineBookingSchema>;

// ───────────────────────────── Callback („Prefer să mă sunați”) ─────────────────────────────

export const callbackSchema = z.object({
  name: zName,
  phone: zPhoneRo,
  /** „după ora 16”, „marți dimineața”. */
  preferredTime: zOptionalText(120),
  locationId: optionalField(zId),
  serviceId: optionalField(zId),
  doctorId: optionalField(zId),
  comfort: zComfort,
  consentGdpr: zConsentRequired,
  idempotencyKey: optionalField(zIdempotencyKey),
  sourcePath: zSourcePath,
});

export type CallbackInput = z.output<typeof callbackSchema>;

// ───────────────────────────── Public slots API ─────────────────────────────

/** Query of `GET /api/public/slots?clinica=&serviciu=&medic=&de=YYYY-MM-DD&zile=7`. */
export const slotsQuerySchema = z.object({
  clinica: z.string().trim().min(1).max(40),
  serviciu: z.string().trim().min(1).max(40),
  medic: optionalField(z.string().trim().min(1).max(80)),
  de: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  zile: optionalField(z.coerce.number().int().min(1).max(14)),
});

export type SlotsQueryInput = z.output<typeof slotsQuerySchema>;
