import type { EInvoiceStatus } from "@/generated/prisma/enums";

/**
 * e-Factura interface (docs/architecture.md §9.4). v1 ships only the `none` provider; a real
 * provider (SmartBill, ANAF SPV) implements the same interface later. Client-safe types.
 */

/** Plain DTO handed to a provider: seller from settings.clinic, buyer, lines, totals, VAT note. */
export type InvoiceForEInvoice = {
  id: string;
  number: string;
  series: string;
  issuedAt: string;
  dueAt: string | null;
  currency: string;
  seller: {
    legalName: string;
    cui: string;
    regCom: string;
    address: string;
    email: string;
    iban: string | null;
    bank: string | null;
  };
  buyer: {
    name: string;
    address: string | null;
    email: string | null;
    company: string | null;
    cui: string | null;
    regCom: string | null;
  };
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    vatRate: number;
    total: number;
  }[];
  totals: { subtotal: number; discountTotal: number; vatTotal: number; total: number };
  vatNote: string;
};

export type EInvoiceResult = { status: EInvoiceStatus; ref?: string; error?: string };

export interface EInvoiceProvider {
  /** "none" | "smartbill" | "anaf-spv" (future) */
  readonly name: string;
  /** Whether the provider can actually transmit; the UI disables „Trimiteți în SPV” when false. */
  readonly canSubmit: boolean;
  submit(invoice: InvoiceForEInvoice): Promise<EInvoiceResult>;
  status(ref: string): Promise<{ status: EInvoiceStatus; error?: string }>;
}
