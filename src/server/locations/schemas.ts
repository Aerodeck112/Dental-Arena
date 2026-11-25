import { z } from "zod";
import { zCheckbox, zId, zPhoneRo, zText } from "@/lib/validation/common";

/** zod schemas for the locations Server Actions (WP8). Pure and client-safe. */

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const zCoord = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().replace(",", ".")) : v),
    z.coerce.number({ error: msg }).min(min, msg).max(max, msg).optional(),
  );

export const locationSchema = z.object({
  id: zId,
  name: zText(120).pipe(z.string().min(1, "Completați numele clinicii.")),
  shortName: zText(40).pipe(z.string().min(1, "Completați numele scurt.")),
  street: zText(160).pipe(z.string().min(1, "Completați strada și numărul.")),
  city: zText(80).pipe(z.string().min(1, "Completați localitatea.")),
  county: zText(40).pipe(z.string().min(1, "Completați județul.")),
  postalCode: z.preprocess(blank, z.string().trim().regex(/^\d{6}$/, "Codul poștal are 6 cifre.").optional()),
  phone: zPhoneRo,
  email: z.preprocess(blank, z.string().trim().toLowerCase().email("Introduceți o adresă de e-mail validă.").optional()),
  mapsUrl: z.preprocess(
    blank,
    z
      .string()
      .trim()
      .url("Introduceți o adresă completă, de exemplu https://maps.google.com/…")
      .refine((u) => /^https:\/\/(www\.)?(google\.com|maps\.google\.com)\//.test(u), "Folosiți un link Google Maps (https://maps.google.com/…).")
      .optional(),
  ),
  latitude: zCoord(-90, 90, "Latitudinea este un număr între -90 și 90."),
  longitude: zCoord(-180, 180, "Longitudinea este un număr între -180 și 180."),
  publishHours: zCheckbox,
  sedationUnits: z.coerce.number({ error: "Introduceți un număr." }).int().min(0, "Minimum 0.").max(10, "Maximum 10."),
  sortOrder: z.coerce.number({ error: "Introduceți un număr." }).int().min(0).max(99),
  active: zCheckbox,
});

export const hoursRowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  openMinute: z.number().int().min(0).max(1440),
  closeMinute: z.number().int().min(0).max(1440),
});

export const hoursSchema = z.object({
  locationId: zId,
  hours: z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return v;
    }
  }, z.array(hoursRowSchema).max(28)),
});

export const cabinetSchema = z.object({
  id: z.preprocess(blank, zId.optional()),
  locationId: zId,
  name: zText(40).pipe(z.string().min(1, "Completați numele cabinetului.")),
  sortOrder: z.coerce.number({ error: "Introduceți un număr." }).int().min(0).max(99),
  active: zCheckbox,
});

export type LocationInput = z.output<typeof locationSchema>;
export type HoursRow = z.output<typeof hoursRowSchema>;
export type CabinetInput = z.output<typeof cabinetSchema>;

/** Romanian problems with a week of opening intervals; [] = valid. Pure, shared with HoursEditor. */
export function hoursProblems(rows: HoursRow[]): string[] {
  const out: string[] = [];
  const byDay = new Map<number, HoursRow[]>();
  for (const r of rows) {
    if (r.openMinute >= r.closeMinute) out.push(`Ziua ${r.weekday}: ora de închidere trebuie să fie după ora de deschidere.`);
    if (r.openMinute % 5 !== 0 || r.closeMinute % 5 !== 0) out.push(`Ziua ${r.weekday}: orele se rotunjesc la 5 minute.`);
    byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), r]);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.openMinute - b.openMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].openMinute < sorted[i - 1].closeMinute) out.push(`Ziua ${day}: intervalele se suprapun.`);
    }
  }
  return [...new Set(out)];
}
