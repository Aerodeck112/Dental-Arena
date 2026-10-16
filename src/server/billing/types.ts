import type { EInvoiceStatus, InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";

/**
 * Billing DTOs and pure shapes (docs/architecture.md §3.2 invariant 4, WP8). Client-safe: no
 * Prisma rows cross into client components, only these plain objects. All money is in bani.
 */

/** One invoice line as entered (client preview) or validated (server). */
export type InvoiceLineInput = {
  /** Where the line came from, for traceability and the „not yet invoiced” filters. */
  source: InvoiceLineSource;
  serviceId?: string | null;
  treatmentPlanItemId?: string | null;
  /** Appointment the line was taken from (not stored; used to avoid double-billing a visit). */
  appointmentId?: string | null;
  doctorId?: string | null;
  description: string;
  tooth?: number | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  vatRate: number;
};

export type InvoiceLineSource = "PLAN" | "PROGRAMARE" | "CATALOG" | "LIBER";

export type LineTotals = { gross: number; discount: number; net: number; vat: number; total: number };

export type InvoiceTotals = {
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  lines: LineTotals[];
};

/** Payment state of an invoice, derived from total and amountPaid. */
export type InvoicePaymentState = "ANULATA" | "NEPLATITA" | "PARTIAL" | "PLATITA";

export type BalanceDTO = { invoiced: number; paid: number; balance: number };

/** A billable line offered on the „Factură nouă” screen. */
export type InvoiceCandidate = {
  key: string;
  source: Exclude<InvoiceLineSource, "LIBER">;
  serviceId: string | null;
  treatmentPlanItemId: string | null;
  appointmentId: string | null;
  doctorId: string | null;
  doctorName: string | null;
  description: string;
  tooth: number | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** „Plan implant 36, faza 1, efectuat” or „Programare din 07.10.2026”. */
  context: string;
  /** For appointment lines: an invoice of the same service already exists after that visit. */
  possiblyInvoiced?: boolean;
};

export type InvoiceListRow = {
  id: string;
  number: string;
  issuedAt: string;
  patientId: string;
  patientName: string;
  locationName: string;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  paymentState: InvoicePaymentState;
  eInvoiceStatus: EInvoiceStatus;
};

export type InvoiceItemDTO = {
  id: string;
  description: string;
  tooth: number | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  vatRate: number;
  total: number;
  doctorName: string | null;
  serviceCode: string | null;
};

export type PaymentRow = {
  id: string;
  paidAt: string;
  patientId: string;
  patientName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  locationId: string;
  locationName: string;
  amount: number;
  method: PaymentMethod;
  receipt: string | null;
  reference: string | null;
  notes: string | null;
  receivedByName: string | null;
  cancelled: boolean;
  cancelReason: string | null;
};

export type InvoiceDetail = {
  id: string;
  number: string;
  series: string;
  status: InvoiceStatus;
  paymentState: InvoicePaymentState;
  issuedAt: string;
  dueAt: string | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  amountPaid: number;
  openAmount: number;
  buyer: {
    name: string;
    address: string | null;
    email: string | null;
    company: string | null;
    cui: string | null;
    regCom: string | null;
  };
  patient: { id: string; name: string; fileNumber: number };
  location: { id: string; name: string; address: string; phone: string };
  notes: string | null;
  eInvoiceStatus: EInvoiceStatus;
  eInvoiceRef: string | null;
  eInvoiceError: string | null;
  createdByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  items: InvoiceItemDTO[];
  payments: PaymentRow[];
};

/** Seller block for the invoice view and print (from `settings.clinic` + `settings.invoicing`). */
export type SellerInfo = {
  displayName: string;
  legalName: string;
  cui: string;
  regCom: string;
  registeredAddress: string;
  email: string;
  iban: string | null;
  bank: string | null;
  vatNote: string;
};

/** Daily journal of payments: totals per day × location × method. */
export type PaymentJournal = {
  rows: PaymentRow[];
  total: number;
  count: number;
  byMethod: Record<PaymentMethod, number>;
  byDay: { dateISO: string; total: number; byMethod: Record<PaymentMethod, number> }[];
  byLocation: { locationId: string; locationName: string; total: number; byMethod: Record<PaymentMethod, number> }[];
};
