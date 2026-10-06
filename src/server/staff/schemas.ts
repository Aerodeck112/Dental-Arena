import { z } from "zod";
import { zCheckbox, zEmail, zId, zOptionalText, zPhoneRo, zText } from "@/lib/validation/common";

/** zod schemas for the team Server Actions (WP8). Pure and client-safe. */

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const zRole = z.enum(["ADMIN", "MEDIC", "RECEPTIE"], { error: "Alegeți rolul." });
/** Clinicile bifate. Cel puțin una; un administrator vede oricum toate clinicile. */
const zLocationIds = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(zId).min(1, "Bifați cel puțin o clinică."),
);
const zName = (label: string) => zText(80).pipe(z.string().min(1, `Completați ${label}.`));

export const createUserSchema = z.object({
  email: zEmail,
  firstName: zName("prenumele"),
  lastName: zName("numele"),
  phone: z.preprocess(blank, zPhoneRo.optional()),
  role: zRole,
  locationIds: zLocationIds,
  password: z.string().min(1, "Completați parola inițială.").max(200),
  linkDoctorId: z.preprocess(blank, zId.optional()),
});

export const updateUserSchema = z.object({
  id: zId,
  email: zEmail,
  firstName: zName("prenumele"),
  lastName: zName("numele"),
  phone: z.preprocess(blank, zPhoneRo.optional()),
  role: zRole,
  locationIds: zLocationIds,
});

export const resetPasswordSchema = z.object({
  id: zId,
  password: z.string().min(1, "Completați parola nouă.").max(200),
});

export const setActiveSchema = z.object({ id: zId, active: zCheckbox });

const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Folosiți litere mici fără diacritice, cifre și cratimă, de exemplu andrei-marcoci.")
  .max(80);

export const doctorProfileSchema = z.object({
  doctorId: z.preprocess(blank, zId.optional()),
  userId: z.preprocess(blank, zId.optional()),
  slug: zSlug,
  honorific: zText(20),
  firstName: zName("prenumele"),
  lastName: zName("numele"),
  publicName: zName("numele public"),
  roleLine: zText(160).pipe(z.string().min(1, "Completați rândul cu specializarea.")),
  bio: zOptionalText(3000),
  photoPath: z.preprocess(
    blank,
    z
      .string()
      .trim()
      .regex(/^\/images\/[a-z0-9/_.-]+\.(?:jpe?g|png|webp|avif)$/i, "Fotografia trebuie să fie o cale din /images/, de exemplu /images/echipa/andrei-marcoci.jpg.")
      .optional(),
  ),
  monogram: z.preprocess(blank, z.string().trim().toUpperCase().regex(/^[A-ZĂÂÎȘȚ]{1,3}$/, "Monograma are 1–3 litere.").optional()),
  publicVisible: zCheckbox,
  acceptsOnlineBooking: zCheckbox,
  active: zCheckbox,
  sortOrder: z.coerce.number({ error: "Ordinea este un număr." }).int().min(0).max(999),
  categoryIds: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(zId)),
  showOnSiteIds: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(zId)),
});

export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
export type DoctorProfileInput = z.output<typeof doctorProfileSchema>;
