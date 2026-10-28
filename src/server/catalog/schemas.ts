import { z } from "zod";
import { zCheckbox, zId, zOptionalText, zText } from "@/lib/validation/common";
import { parsePriceText } from "./price";

/** zod schemas for the catalog Server Actions (WP8). Pure and client-safe. */

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Folosiți doar litere mici fără diacritice, cifre și cratimă, de exemplu implantologie.")
  .max(80);
const zInt = (min: number, max: number, msg: string) => z.coerce.number({ error: msg }).int(msg).min(min, msg).max(max, msg);

export const categorySchema = z.object({
  id: z.preprocess(blank, zId.optional()),
  slug: zSlug,
  name: zText(80).pipe(z.string().min(1, "Completați numele categoriei.")),
  summary: zOptionalText(300),
  sortOrder: zInt(0, 999, "Ordinea este un număr între 0 și 999."),
  publicVisible: zCheckbox,
  active: zCheckbox,
});

export const serviceSchema = z
  .object({
    id: z.preprocess(blank, zId.optional()),
    categoryId: zId,
    code: z.preprocess(
      blank,
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Codul are majuscule, cifre și cratimă, de exemplu IMP-NEODENT.")
        .max(40)
        .optional(),
    ),
    name: zText(120).pipe(z.string().min(1, "Completați numele serviciului.")),
    price: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()),
    unit: z.enum(["ACT", "DINTE", "ARCADA", "ORA", "SEDINTA"]),
    durationMinutes: zInt(5, 480, "Durata este între 5 și 480 de minute.").refine((v) => v % 5 === 0, "Durata se rotunjește la 5 minute."),
    bookableOnline: zCheckbox,
    onlineLabel: zOptionalText(80),
    onlineHint: zOptionalText(200),
    urgent: zCheckbox,
    isRepresentative: zCheckbox,
    toothSpecific: zCheckbox,
    recallMonths: z.preprocess(blank, zInt(1, 60, "Rechemarea este între 1 și 60 de luni.").optional()),
    publicVisible: zCheckbox,
    active: zCheckbox,
    sortOrder: zInt(0, 999, "Ordinea este un număr între 0 și 999."),
  })
  .transform((v, ctx) => {
    const p = parsePriceText(v.price);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", path: ["price"], message: p.error });
      return z.NEVER;
    }
    if (v.bookableOnline && !v.onlineLabel) {
      ctx.addIssue({ code: "custom", path: ["onlineLabel"], message: "Completați eticheta afișată în programarea online." });
      return z.NEVER;
    }
    const { price: _price, ...rest } = v;
    void _price;
    return { ...rest, ...p.value };
  });

export type CategoryInput = z.output<typeof categorySchema>;
export type ServiceInput = z.output<typeof serviceSchema>;
