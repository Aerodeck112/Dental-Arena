import { z } from "zod";
import { zDateISO, zId, zLei, zOptionalText, zText } from "@/lib/validation/common";

/**
 * zod schemas for the billing Server Actions (WP8). Pure and client-safe. Invoice lines travel as
 * one JSON hidden field (`lines`) because the editor is dynamic; amounts inside it are bani.
 */

const zBani = z.number().int().min(0).max(100_000_000);
const zOptionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), zId.optional());

export const invoiceLineSchema = z.object({
  source: z.enum(["PLAN", "PROGRAMARE", "CATALOG", "LIBER"]),
  serviceId: zOptionalId,
  treatmentPlanItemId: zOptionalId,
  appointmentId: zOptionalId,
  doctorId: zOptionalId,
  description: zText(200).pipe(z.string().min(1, "Completați descrierea liniei.")),
  tooth: z.number().int().min(11).max(85).nullable().optional(),
  quantity: z.number().int().min(1, "Cantitatea minimă este 1.").max(999),
  unitPrice: zBani,
  discount: zBani,
  vatRate: z.number().int().min(0).max(100),
});

const jsonArray = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return v;
  }
}, z.array(invoiceLineSchema).min(1, "Adăugați cel puțin o linie pe factură.").max(100, "O factură are cel mult 100 de linii."));

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);

export const createInvoiceSchema = z
  .object({
    patientId: zId,
    locationId: zId,
    lines: jsonArray,
    buyerName: zText(160).pipe(z.string().min(1, "Completați numele cumpărătorului.")),
    buyerAddress: zOptionalText(300),
    buyerEmail: z.preprocess(blank, z.string().trim().toLowerCase().email("Introduceți o adresă de e-mail validă.").max(254).optional()),
    isCompany: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
    buyerCompany: zOptionalText(200),
    buyerCui: z.preprocess(blank, z.string().trim().toUpperCase().regex(/^(RO)?\d{2,10}$/, "CUI-ul are 2–10 cifre, opțional cu prefixul RO.").optional()),
    buyerRegCom: z.preprocess(blank, z.string().trim().toUpperCase().max(40).optional()),
    notes: zOptionalText(1000),
    payNow: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
    payMethod: z.preprocess(blank, z.enum(["NUMERAR", "CARD", "TRANSFER"]).optional()),
    payAmount: z.preprocess(blank, zLei.optional()),
    payReference: zOptionalText(80),
  })
  .superRefine((v, ctx) => {
    if (v.isCompany) {
      if (!v.buyerCompany) ctx.addIssue({ code: "custom", path: ["buyerCompany"], message: "Completați denumirea firmei." });
      if (!v.buyerCui) ctx.addIssue({ code: "custom", path: ["buyerCui"], message: "Completați CUI-ul firmei." });
    }
    if (v.payNow && !v.payMethod) ctx.addIssue({ code: "custom", path: ["payMethod"], message: "Alegeți metoda de plată." });
  });

export type CreateInvoiceInput = z.output<typeof createInvoiceSchema>;

export const cancelSchema = z.object({
  id: zId,
  reason: zText(300).pipe(z.string().min(3, "Scrieți motivul anulării (cel puțin 3 caractere).")),
});

export const recordPaymentSchema = z.object({
  patientId: zId,
  invoiceId: zOptionalId,
  locationId: zOptionalId,
  amount: zLei.refine((v) => v > 0, "Suma trebuie să fie mai mare decât 0."),
  method: z.enum(["NUMERAR", "CARD", "TRANSFER"], { error: "Alegeți metoda de plată." }),
  paidOn: z.preprocess(blank, zDateISO.optional()),
  reference: zOptionalText(80),
  notes: zOptionalText(500),
});

export type RecordPaymentInput = z.output<typeof recordPaymentSchema>;
