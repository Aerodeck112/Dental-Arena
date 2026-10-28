import "server-only";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { nextSequence, SEQUENCE_KEYS } from "@/lib/sequences";
import { getSettings } from "@/lib/settings";
import { localToUtc, todayISO, utcToLocal } from "@/lib/time";
import { emptyByMethod, formatDocNumber, openAmount, paymentProblems, sumActivePayments } from "./totals";
import type { PaymentJournal, PaymentRow } from "./types";

/**
 * Payments (încasări): against an invoice or on account, cash / card / transfer
 * (docs/architecture.md §3.2 invariants 4–5, WP8). Cash gets a receipt number from the
 * `CHITANTA:<serie>` sequence inside the same transaction; `Invoice.amountPaid` is recomputed in
 * that transaction too. Cancelling is ADMIN only.
 */

export type PaymentWrite = {
  patientId: string;
  invoiceId?: string | null;
  locationId?: string | null;
  amount: number;
  method: PaymentMethod;
  paidAt?: Date;
  reference?: string | null;
  notes?: string | null;
};

/** `Invoice.amountPaid = Σ` non-cancelled payments, rewritten inside the caller's transaction. */
export async function recomputeAmountPaid(tx: Tx, invoiceId: string): Promise<number> {
  const payments = await tx.payment.findMany({ where: { invoiceId }, select: { amount: true, cancelledAt: true } });
  const amountPaid = sumActivePayments(payments);
  await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid } });
  return amountPaid;
}

/**
 * Inserts one payment inside an open transaction (used by `recordPayment` and by „încasare
 * imediată” on invoice creation). Validates ownership, open amount and location.
 */
export async function insertPayment(
  tx: Tx,
  p: PaymentWrite,
  actor: CurrentUser,
  receiptSeries: string,
): Promise<{ id: string; receipt: string | null }> {
  let locationId = p.locationId ?? null;
  let open: number | null = null;
  if (p.invoiceId) {
    const inv = await tx.invoice.findUnique({
      where: { id: p.invoiceId },
      select: { id: true, patientId: true, status: true, total: true, amountPaid: true, locationId: true },
    });
    if (!inv || inv.patientId !== p.patientId) throw new DomainError("NOT_FOUND", "Factura nu există pentru acest pacient.");
    if (inv.status === "ANULATA") throw new DomainError("VALIDATION", "Factura este anulată; înregistrați plata în cont.");
    open = openAmount(inv.total, inv.amountPaid);
    if (open === 0) throw new DomainError("VALIDATION", "Factura este deja plătită integral.");
    locationId ??= inv.locationId;
  } else {
    const patient = await tx.patient.findUnique({ where: { id: p.patientId }, select: { id: true, anonymizedAt: true } });
    if (!patient) throw new DomainError("NOT_FOUND", "Pacientul nu există.");
  }
  if (!locationId) throw new DomainError("VALIDATION", undefined, { fieldErrors: { locationId: ["Alegeți clinica."] } });
  const location = await tx.location.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) throw new DomainError("VALIDATION", undefined, { fieldErrors: { locationId: ["Clinica nu există."] } });

  const problems = paymentProblems({ amount: p.amount, open });
  if (problems.length > 0) throw new DomainError("VALIDATION", undefined, { fieldErrors: { amount: problems } });

  let receiptNumber: number | null = null;
  if (p.method === "NUMERAR") receiptNumber = await nextSequence(tx, SEQUENCE_KEYS.receipt(receiptSeries));

  const payment = await tx.payment.create({
    data: {
      patientId: p.patientId,
      invoiceId: p.invoiceId ?? null,
      locationId,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt ?? new Date(),
      receiptSeries: receiptNumber !== null ? receiptSeries : null,
      receiptNumber,
      reference: p.reference ?? null,
      notes: p.notes ?? null,
      receivedById: actor.id,
    },
    select: { id: true },
  });
  if (p.invoiceId) await recomputeAmountPaid(tx, p.invoiceId);
  await audit(
    {
      action: "payment.create",
      entityType: "Payment",
      entityId: payment.id,
      patientId: p.patientId,
      metadata: { method: p.method, invoiceId: p.invoiceId ?? null, onAccount: !p.invoiceId, receipt: receiptNumber !== null },
    },
    { actor, db: tx },
  );
  return { id: payment.id, receipt: receiptNumber !== null ? formatDocNumber(receiptSeries, receiptNumber) : null };
}

/** Records a payment in its own transaction. `paidOn` (a local date) defaults to now. */
export async function recordPayment(
  p: Omit<PaymentWrite, "paidAt"> & { paidOn?: string | null },
  actor: CurrentUser,
): Promise<{ id: string; receipt: string | null }> {
  const { receiptSeries } = await getSettings("invoicing");
  let paidAt = new Date();
  if (p.paidOn && p.paidOn !== todayISO()) {
    if (p.paidOn > todayISO()) throw new DomainError("VALIDATION", undefined, { fieldErrors: { paidOn: ["Data plății nu poate fi în viitor."] } });
    paidAt = localToUtc(p.paidOn, 12 * 60);
  }
  return prisma.$transaction((tx) => insertPayment(tx, { ...p, paidAt }, actor, receiptSeries));
}

/** ADMIN only. The payment stays in the journal, struck through; the invoice's amountPaid drops. */
export async function cancelPayment(id: string, reason: string, actor: CurrentUser): Promise<{ id: string; patientId: string; invoiceId: string | null }> {
  if (!can(actor, "billing.cancel")) throw new DomainError("FORBIDDEN", "Doar administratorul poate anula o încasare.");
  return prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id }, select: { id: true, patientId: true, invoiceId: true, cancelledAt: true } });
    if (!pay) throw new DomainError("NOT_FOUND", "Încasarea nu există.");
    if (pay.cancelledAt) throw new DomainError("VALIDATION", "Încasarea este deja anulată.");
    await tx.payment.update({
      where: { id },
      data: { cancelledAt: new Date(), cancelledById: actor.id, cancelReason: reason },
    });
    if (pay.invoiceId) await recomputeAmountPaid(tx, pay.invoiceId);
    await audit(
      { action: "payment.cancel", entityType: "Payment", entityId: id, patientId: pay.patientId, metadata: { fields: ["cancelReason"] } },
      { actor, db: tx },
    );
    return { id, patientId: pay.patientId, invoiceId: pay.invoiceId };
  });
}

const paymentSelect = {
  id: true,
  paidAt: true,
  patientId: true,
  invoiceId: true,
  locationId: true,
  amount: true,
  method: true,
  receiptSeries: true,
  receiptNumber: true,
  reference: true,
  notes: true,
  receivedById: true,
  cancelledAt: true,
  cancelReason: true,
  patient: { select: { firstName: true, lastName: true } },
  invoice: { select: { series: true, number: true } },
  location: { select: { shortName: true } },
} as const;

type PaymentSelected = {
  id: string;
  paidAt: Date;
  patientId: string;
  invoiceId: string | null;
  locationId: string;
  amount: number;
  method: PaymentMethod;
  receiptSeries: string | null;
  receiptNumber: number | null;
  reference: string | null;
  notes: string | null;
  receivedById: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  patient: { firstName: string; lastName: string };
  invoice: { series: string; number: number } | null;
  location: { shortName: string };
};

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, personName(u)]));
}

export function toPaymentRow(p: PaymentSelected, names: Map<string, string>): PaymentRow {
  return {
    id: p.id,
    paidAt: p.paidAt.toISOString(),
    patientId: p.patientId,
    patientName: personName(p.patient),
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoice ? formatDocNumber(p.invoice.series, p.invoice.number) : null,
    locationId: p.locationId,
    locationName: p.location.shortName,
    amount: p.amount,
    method: p.method,
    receipt: p.receiptSeries && p.receiptNumber !== null ? formatDocNumber(p.receiptSeries, p.receiptNumber) : null,
    reference: p.reference,
    notes: p.notes,
    receivedByName: p.receivedById ? (names.get(p.receivedById) ?? null) : null,
    cancelled: p.cancelledAt !== null,
    cancelReason: p.cancelReason,
  };
}

export async function listPaymentsWhere(where: Record<string, unknown>, take = 500): Promise<PaymentRow[]> {
  const rows = (await prisma.payment.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
    select: paymentSelect,
  })) as PaymentSelected[];
  const names = await userNames(rows.map((r) => r.receivedById));
  return rows.map((r) => toPaymentRow(r, names));
}

export async function listPatientPayments(patientId: string): Promise<PaymentRow[]> {
  return listPaymentsWhere({ patientId });
}

/** Builds the journal totals from rows (pure, exported for tests). Cancelled rows are listed but not summed. */
export function summarizeJournal(rows: PaymentRow[]): PaymentJournal {
  const byMethod = emptyByMethod();
  const days = new Map<string, PaymentJournal["byDay"][number]>();
  const locations = new Map<string, PaymentJournal["byLocation"][number]>();
  let total = 0;
  let count = 0;
  for (const r of rows) {
    if (r.cancelled) continue;
    count += 1;
    total += r.amount;
    byMethod[r.method] += r.amount;
    const dateISO = utcToLocal(new Date(r.paidAt)).dateISO;
    const day = days.get(dateISO) ?? { dateISO, total: 0, byMethod: emptyByMethod() };
    day.total += r.amount;
    day.byMethod[r.method] += r.amount;
    days.set(dateISO, day);
    const loc = locations.get(r.locationId) ?? { locationId: r.locationId, locationName: r.locationName, total: 0, byMethod: emptyByMethod() };
    loc.total += r.amount;
    loc.byMethod[r.method] += r.amount;
    locations.set(r.locationId, loc);
  }
  return {
    rows,
    total,
    count,
    byMethod,
    byDay: [...days.values()].sort((a, b) => b.dateISO.localeCompare(a.dateISO)),
    byLocation: [...locations.values()].sort((a, b) => a.locationName.localeCompare(b.locationName, "ro")),
  };
}

/** Payments journal for [from, to) in the given clinics, optionally one method. */
export async function getPaymentJournal(f: {
  from: Date;
  to: Date;
  locationIds: string[];
  method?: PaymentMethod | null;
}): Promise<PaymentJournal> {
  const rows = await listPaymentsWhere(
    {
      paidAt: { gte: f.from, lt: f.to },
      locationId: { in: f.locationIds },
      ...(f.method ? { method: f.method } : {}),
    },
    2000,
  );
  return summarizeJournal(rows);
}
