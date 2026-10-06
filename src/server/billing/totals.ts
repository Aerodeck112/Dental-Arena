import type { PaymentMethod } from "@/generated/prisma/enums";
import type { InvoiceLineInput, InvoicePaymentState, InvoiceTotals, LineTotals } from "./types";

/**
 * Pure money math for invoices, payments and balances (docs/architecture.md §3.2 invariant 4).
 * The server computes the stored totals with these functions and the client preview calls the
 * very same ones, so what the receptionist sees is what gets saved. All amounts are integer bani.
 */

type LineMath = Pick<InvoiceLineInput, "quantity" | "unitPrice" | "discount" | "vatRate">;

/** `total = quantity × unitPrice − discount (+ VAT on the net)`. VAT is rounded half-up per line. */
export function lineTotals(l: LineMath): LineTotals {
  const gross = l.quantity * l.unitPrice;
  const net = gross - l.discount;
  const vat = Math.round((net * l.vatRate) / 100);
  return { gross, discount: l.discount, net, vat, total: net + vat };
}

/** Invoice totals: subtotal = Σ q×p, discountTotal = Σ discount, total = subtotal − discountTotal + vatTotal. */
export function computeInvoiceTotals(lines: LineMath[]): InvoiceTotals {
  const each = lines.map(lineTotals);
  const subtotal = each.reduce((s, l) => s + l.gross, 0);
  const discountTotal = each.reduce((s, l) => s + l.discount, 0);
  const vatTotal = each.reduce((s, l) => s + l.vat, 0);
  return { subtotal, discountTotal, vatTotal, total: subtotal - discountTotal + vatTotal, lines: each };
}

/** Romanian problems with one line; [] = valid. Used by the server and the client editor. */
export function lineProblems(l: LineMath & { description?: string }): string[] {
  const out: string[] = [];
  if (l.description !== undefined && l.description.trim() === "") out.push("Completați descrierea.");
  if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 999) out.push("Cantitatea este între 1 și 999.");
  if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) out.push("Prețul nu poate fi negativ.");
  if (!Number.isInteger(l.discount) || l.discount < 0) out.push("Reducerea nu poate fi negativă.");
  else if (l.discount > l.quantity * l.unitPrice) out.push("Reducerea nu poate depăși valoarea liniei.");
  if (!Number.isInteger(l.vatRate) || l.vatRate < 0 || l.vatRate > 100) out.push("Cota TVA este între 0 și 100.");
  return out;
}

/** Σ of the non-cancelled payment amounts (the stored `Invoice.amountPaid`). */
export function sumActivePayments(payments: { amount: number; cancelledAt?: Date | string | null }[]): number {
  return payments.reduce((s, p) => (p.cancelledAt ? s : s + p.amount), 0);
}

/** Positive = the patient owes money; negative = credit on account. */
export function computeBalance(invoiced: number, paid: number): { invoiced: number; paid: number; balance: number } {
  return { invoiced, paid, balance: invoiced - paid };
}

/** What is still to be paid on an invoice (never negative). */
export function openAmount(total: number, amountPaid: number): number {
  return Math.max(0, total - amountPaid);
}

export function invoicePaymentState(i: { status: "EMISA" | "ANULATA"; total: number; amountPaid: number }): InvoicePaymentState {
  if (i.status === "ANULATA") return "ANULATA";
  if (i.amountPaid <= 0 && i.total > 0) return "NEPLATITA";
  if (i.amountPaid < i.total) return "PARTIAL";
  return "PLATITA";
}

export const INVOICE_PAYMENT_STATE_LABEL: Record<InvoicePaymentState, string> = {
  ANULATA: "Anulată",
  NEPLATITA: "Neplătită",
  PARTIAL: "Plătită parțial",
  PLATITA: "Plătită",
};

/** „DA-000001”: series, dash, six-digit zero-padded number. */
export function formatDocNumber(series: string, number: number): string {
  return `${series}-${String(number).padStart(6, "0")}`;
}

/** Checks a payment against what is still open on its invoice. [] = ok. */
export function paymentProblems(p: { amount: number; open?: number | null }): string[] {
  const out: string[] = [];
  if (!Number.isInteger(p.amount) || p.amount <= 0) out.push("Suma trebuie să fie mai mare decât 0.");
  else if (p.open !== undefined && p.open !== null && p.amount > p.open) out.push("Suma depășește restul de plată al facturii.");
  return out;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["NUMERAR", "CARD", "TRANSFER"];

export function emptyByMethod(): Record<PaymentMethod, number> {
  return { NUMERAR: 0, CARD: 0, TRANSFER: 0 };
}
