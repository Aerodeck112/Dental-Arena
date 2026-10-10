import "server-only";
import type { InvoiceStatus } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma, type Db, type Prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { formatDateRo, personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { normalizeSearch } from "@/lib/search";
import { nextSequence, SEQUENCE_KEYS } from "@/lib/sequences";
import { getSettings } from "@/lib/settings";
import { localDayRangeUtc, utcToLocal } from "@/lib/time";
import type { InvoiceForEInvoice } from "./einvoice/types";
import { insertPayment, listPaymentsWhere } from "./payments";
import { computeInvoiceTotals, formatDocNumber, invoicePaymentState, lineProblems, openAmount } from "./totals";
import type {
  InvoiceCandidate,
  InvoiceDetail,
  InvoiceLineInput,
  InvoiceListRow,
  SellerInfo,
} from "./types";

/**
 * Invoices (docs/architecture.md §3.2 invariants 4–5, WP8). Lines come from accepted or performed
 * plan items, from services of finished appointments, from the catalog or as free text. Totals are
 * computed here with `totals.ts`; numbering is gap-free from `NumberSequence` inside the write
 * transaction. Issued invoices are never deleted, only cancelled (ANULATA).
 */

export const INVOICEABLE_PLAN_ITEM_STATUSES = ["ACCEPTAT", "EFECTUAT"] as const;

// ───────────────────────────── Reads ─────────────────────────────

export type InvoiceListFilter = {
  locationIds: string[];
  patientId?: string;
  status?: InvoiceStatus | "NEPLATITE";
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

/** „DA-000012”, „da 12” or „12” → number 12 (and the series, when given). */
export function parseInvoiceNumberQuery(q: string): { series?: string; number: number } | null {
  const m = q.trim().toUpperCase().match(/^(?:([A-Z]{1,8})[\s-]*)?0*(\d{1,9})$/);
  if (!m) return null;
  return { series: m[1], number: Number(m[2]) };
}

export async function listInvoices(f: InvoiceListFilter): Promise<{
  rows: InvoiceListRow[];
  count: number;
  page: number;
  pageSize: number;
  sums: { total: number; amountPaid: number; open: number };
}> {
  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const and: Prisma.InvoiceWhereInput[] = [{ locationId: { in: f.locationIds } }];
  if (f.patientId) and.push({ patientId: f.patientId });
  if (f.status === "NEPLATITE") and.push({ status: "EMISA" });
  else if (f.status) and.push({ status: f.status });
  if (f.from || f.to) and.push({ issuedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } });
  const q = f.q?.trim();
  if (q) {
    const num = parseInvoiceNumberQuery(q);
    const text = normalizeSearch(q);
    and.push({
      OR: [
        ...(num ? [{ number: num.number, ...(num.series ? { series: num.series } : {}) }] : []),
        { patient: { searchText: { contains: text } } },
      ],
    });
  }
  // „Neplătite”: issued and not fully paid (a column-to-column comparison, done in the database).
  if (f.status === "NEPLATITE") and.push({ amountPaid: { lt: prisma.invoice.fields.total } });
  const where: Prisma.InvoiceWhereInput = { AND: and };

  const [count, issued, list] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where: { AND: [...and, { status: "EMISA" }] }, _sum: { total: true, amountPaid: true } }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ issuedAt: "desc" }, { number: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        series: true,
        number: true,
        issuedAt: true,
        patientId: true,
        total: true,
        amountPaid: true,
        status: true,
        eInvoiceStatus: true,
        patient: { select: { firstName: true, lastName: true } },
        location: { select: { shortName: true } },
      },
    }),
  ]);
  const total = issued._sum.total ?? 0;
  const amountPaid = issued._sum.amountPaid ?? 0;
  // amountPaid never exceeds total on an issued invoice, so the open sum is the difference.
  const sums = { total, amountPaid, open: Math.max(0, total - amountPaid) };
  const rows = list.map(
    (i): InvoiceListRow => ({
      id: i.id,
      number: formatDocNumber(i.series, i.number),
      issuedAt: i.issuedAt.toISOString(),
      patientId: i.patientId,
      patientName: personName(i.patient),
      locationName: i.location.shortName,
      total: i.total,
      amountPaid: i.amountPaid,
      status: i.status,
      paymentState: invoicePaymentState(i),
      eInvoiceStatus: i.eInvoiceStatus,
    }),
  );
  return { rows, count, page, pageSize, sums };
}

export async function listPatientInvoices(patientId: string): Promise<InvoiceListRow[]> {
  const locations = await prisma.location.findMany({ select: { id: true } });
  return (await listInvoices({ locationIds: locations.map((l) => l.id), patientId, pageSize: 500 })).rows;
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      series: true,
      number: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      currency: true,
      subtotal: true,
      discountTotal: true,
      vatTotal: true,
      total: true,
      amountPaid: true,
      buyerName: true,
      buyerAddress: true,
      buyerEmail: true,
      buyerCompany: true,
      buyerCui: true,
      buyerRegCom: true,
      notes: true,
      eInvoiceStatus: true,
      eInvoiceRef: true,
      eInvoiceError: true,
      createdById: true,
      cancelledAt: true,
      cancelledById: true,
      cancelReason: true,
      patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } },
      location: { select: { id: true, name: true, street: true, city: true, county: true, phone: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          tooth: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          vatRate: true,
          total: true,
          doctor: { select: { publicName: true } },
          service: { select: { code: true } },
        },
      },
    },
  });
  if (!inv) return null;
  const userIds = [inv.createdById, inv.cancelledById].filter((v): v is string => !!v);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const nameOf = (uid: string | null) => {
    const u = users.find((x) => x.id === uid);
    return u ? personName(u) : null;
  };
  const payments = await listPaymentsWhere({ invoiceId: id });
  return {
    id: inv.id,
    number: formatDocNumber(inv.series, inv.number),
    series: inv.series,
    status: inv.status,
    paymentState: invoicePaymentState(inv),
    issuedAt: inv.issuedAt.toISOString(),
    dueAt: inv.dueAt?.toISOString() ?? null,
    currency: inv.currency,
    subtotal: inv.subtotal,
    discountTotal: inv.discountTotal,
    vatTotal: inv.vatTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    openAmount: inv.status === "EMISA" ? openAmount(inv.total, inv.amountPaid) : 0,
    buyer: {
      name: inv.buyerName,
      address: inv.buyerAddress,
      email: inv.buyerEmail,
      company: inv.buyerCompany,
      cui: inv.buyerCui,
      regCom: inv.buyerRegCom,
    },
    patient: { id: inv.patient.id, name: personName(inv.patient), fileNumber: inv.patient.fileNumber },
    location: {
      id: inv.location.id,
      name: inv.location.name,
      address: [inv.location.street, inv.location.city, `jud. ${inv.location.county}`].join(", "),
      phone: inv.location.phone,
    },
    notes: inv.notes,
    eInvoiceStatus: inv.eInvoiceStatus,
    eInvoiceRef: inv.eInvoiceRef,
    eInvoiceError: inv.eInvoiceError,
    createdByName: nameOf(inv.createdById),
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    cancelledByName: nameOf(inv.cancelledById),
    cancelReason: inv.cancelReason,
    items: inv.items.map((it) => ({
      id: it.id,
      description: it.description,
      tooth: it.tooth,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      vatRate: it.vatRate,
      total: it.total,
      doctorName: it.doctor?.publicName ?? null,
      serviceCode: it.service?.code ?? null,
    })),
    payments,
  };
}

/** The seller block (legal data from settings; „[de completat]” placeholders are flagged in the UI). */
export async function getSellerInfo(): Promise<SellerInfo> {
  const [clinic, invoicing] = await Promise.all([getSettings("clinic"), getSettings("invoicing")]);
  return {
    displayName: clinic.displayName,
    legalName: clinic.legalName,
    cui: clinic.cui,
    regCom: clinic.regCom,
    registeredAddress: clinic.registeredAddress,
    email: clinic.email,
    iban: clinic.iban,
    bank: clinic.bank,
    vatNote: invoicing.vatExemptionNote,
  };
}

export function toEInvoiceDTO(inv: InvoiceDetail, seller: SellerInfo): InvoiceForEInvoice {
  return {
    id: inv.id,
    number: inv.number,
    series: inv.series,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    currency: inv.currency,
    seller: {
      legalName: seller.legalName,
      cui: seller.cui,
      regCom: seller.regCom,
      address: seller.registeredAddress,
      email: seller.email,
      iban: seller.iban,
      bank: seller.bank,
    },
    buyer: inv.buyer,
    lines: inv.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      vatRate: i.vatRate,
      total: i.total,
    })),
    totals: { subtotal: inv.subtotal, discountTotal: inv.discountTotal, vatTotal: inv.vatTotal, total: inv.total },
    vatNote: seller.vatNote,
  };
}

/** Plan item ids that already sit on an issued (non-cancelled) invoice. */
async function invoicedPlanItemIds(db: Db, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.invoiceItem.findMany({
    where: { treatmentPlanItemId: { in: ids }, invoice: { status: "EMISA" } },
    select: { treatmentPlanItemId: true },
  });
  return new Set(rows.map((r) => r.treatmentPlanItemId).filter((v): v is string => !!v));
}

/**
 * Billable lines for a patient: plan items ACCEPTAT/EFECTUAT not yet invoiced, and services of
 * FINALIZAT appointments (last 180 days) that have no plan line of their own.
 */
export async function getInvoiceCandidates(patientId: string, now: Date = new Date()): Promise<{
  plan: InvoiceCandidate[];
  appointments: InvoiceCandidate[];
}> {
  const items = await prisma.treatmentPlanItem.findMany({
    where: {
      status: { in: [...INVOICEABLE_PLAN_ITEM_STATUSES] },
      plan: { patientId, status: { notIn: ["ANULAT", "RESPINS"] } },
    },
    orderBy: [{ plan: { createdAt: "asc" } }, { phase: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      serviceId: true,
      tooth: true,
      description: true,
      phase: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      status: true,
      appointmentId: true,
      performedBy: { select: { id: true, publicName: true } },
      plan: { select: { title: true, doctor: { select: { id: true, publicName: true } } } },
    },
  });
  const invoiced = await invoicedPlanItemIds(prisma, items.map((i) => i.id));
  const plan: InvoiceCandidate[] = items
    .filter((i) => !invoiced.has(i.id))
    .map((i) => {
      const doctor = i.performedBy ?? i.plan.doctor;
      return {
        key: `plan:${i.id}`,
        source: "PLAN",
        serviceId: i.serviceId,
        treatmentPlanItemId: i.id,
        appointmentId: i.appointmentId,
        doctorId: doctor?.id ?? null,
        doctorName: doctor?.publicName ?? null,
        description: i.description,
        tooth: i.tooth,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: Math.min(i.discount, i.quantity * i.unitPrice),
        context: `${i.plan.title}, faza ${i.phase}, ${i.status === "EFECTUAT" ? "efectuat" : "acceptat"}`,
      };
    });

  const since = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const appts = await prisma.appointment.findMany({
    where: { patientId, status: "FINALIZAT", serviceId: { not: null }, startsAt: { gte: since }, planItems: { none: {} } },
    orderBy: { startsAt: "desc" },
    take: 30,
    select: {
      id: true,
      startsAt: true,
      doctor: { select: { id: true, publicName: true } },
      service: { select: { id: true, name: true, priceMin: true } },
    },
  });
  // Heuristic for „possibly invoiced”: InvoiceItem has no appointment link, so we flag a visit when an
  // issued invoice of this patient, dated on or after the visit day, already carries the same service.
  const invoicedServices = await prisma.invoiceItem.findMany({
    where: { invoice: { patientId, status: "EMISA" }, serviceId: { in: appts.map((a) => a.service!.id) } },
    select: { serviceId: true, invoice: { select: { issuedAt: true } } },
  });
  const appointments: InvoiceCandidate[] = appts.map((a) => {
    const dayStart = localDayRangeUtc(utcToLocal(a.startsAt).dateISO).start;
    return {
      key: `appt:${a.id}`,
      source: "PROGRAMARE",
      serviceId: a.service!.id,
      treatmentPlanItemId: null,
      appointmentId: a.id,
      doctorId: a.doctor.id,
      doctorName: a.doctor.publicName,
      description: a.service!.name,
      tooth: null,
      quantity: 1,
      unitPrice: a.service!.priceMin ?? 0,
      discount: 0,
      context: `Programare din ${formatDateRo(a.startsAt, "short")}`,
      possiblyInvoiced: invoicedServices.some((s) => s.serviceId === a.service!.id && s.invoice.issuedAt >= dayStart),
    };
  });
  return { plan, appointments };
}

// ───────────────────────────── Writes ─────────────────────────────

export type CreateInvoiceData = {
  patientId: string;
  locationId: string;
  lines: InvoiceLineInput[];
  buyerName: string;
  buyerAddress?: string | null;
  buyerEmail?: string | null;
  buyerCompany?: string | null;
  buyerCui?: string | null;
  buyerRegCom?: string | null;
  notes?: string | null;
  payNow?: { method: "NUMERAR" | "CARD" | "TRANSFER"; amount?: number | null; reference?: string | null } | null;
  issuedAt?: Date;
};

/** Issues an invoice (and, optionally, records the immediate payment) in one transaction. */
export async function createInvoice(
  d: CreateInvoiceData,
  actor: CurrentUser,
): Promise<{ id: string; number: string; payment: { id: string; receipt: string | null } | null }> {
  if (!can(actor, "billing.create")) throw new DomainError("FORBIDDEN");
  const invoicing = await getSettings("invoicing");
  const fieldErrors: Record<string, string[]> = {};
  d.lines.forEach((l, i) => {
    const p = lineProblems(l);
    if (p.length) fieldErrors[`lines.${i}`] = p;
  });
  const planIds = d.lines.map((l) => l.treatmentPlanItemId).filter((v): v is string => !!v);
  if (new Set(planIds).size !== planIds.length) fieldErrors.lines = ["O linie din plan apare de două ori."];
  if (Object.keys(fieldErrors).length) throw new DomainError("VALIDATION", undefined, { fieldErrors });

  const totals = computeInvoiceTotals(d.lines);
  if (d.payNow?.amount != null && d.payNow.amount > totals.total) {
    throw new DomainError("VALIDATION", undefined, { fieldErrors: { payAmount: ["Suma încasată depășește totalul facturii."] } });
  }

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: d.patientId }, select: { id: true, anonymizedAt: true } });
    if (!patient) throw new DomainError("NOT_FOUND", "Pacientul nu există.");
    if (patient.anonymizedAt) throw new DomainError("VALIDATION", "Pacientul a fost anonimizat; nu se mai emit facturi noi.");
    const location = await tx.location.findUnique({ where: { id: d.locationId }, select: { id: true, active: true } });
    if (!location?.active) throw new DomainError("VALIDATION", undefined, { fieldErrors: { locationId: ["Alegeți o clinică activă."] } });

    if (planIds.length) {
      const items = await tx.treatmentPlanItem.findMany({
        where: { id: { in: planIds } },
        select: { id: true, status: true, plan: { select: { patientId: true } } },
      });
      const ok = items.filter(
        (i) => i.plan.patientId === d.patientId && (INVOICEABLE_PLAN_ITEM_STATUSES as readonly string[]).includes(i.status),
      );
      if (ok.length !== planIds.length) throw new DomainError("VALIDATION", "O linie din plan nu mai poate fi facturată. Reîncărcați pagina.");
      const already = await invoicedPlanItemIds(tx, planIds);
      if (already.size) throw new DomainError("CONFLICT", "O linie din plan a fost deja facturată. Reîncărcați pagina.");
    }
    const serviceIds = [...new Set(d.lines.map((l) => l.serviceId).filter((v): v is string => !!v))];
    if (serviceIds.length && (await tx.service.count({ where: { id: { in: serviceIds } } })) !== serviceIds.length) {
      throw new DomainError("VALIDATION", "Un serviciu de pe factură nu mai există. Reîncărcați pagina.");
    }
    const doctorIds = [...new Set(d.lines.map((l) => l.doctorId).filter((v): v is string => !!v))];
    if (doctorIds.length && (await tx.doctor.count({ where: { id: { in: doctorIds } } })) !== doctorIds.length) {
      throw new DomainError("VALIDATION", "Un medic de pe factură nu mai există. Reîncărcați pagina.");
    }

    const series = invoicing.invoiceSeries;
    const number = await nextSequence(tx, SEQUENCE_KEYS.invoice(series));
    const issuedAt = d.issuedAt ?? new Date();
    const dueAt =
      invoicing.paymentTermDays > 0 ? new Date(issuedAt.getTime() + invoicing.paymentTermDays * 24 * 60 * 60 * 1000) : null;

    const invoice = await tx.invoice.create({
      data: {
        series,
        number,
        patientId: d.patientId,
        locationId: d.locationId,
        issuedAt,
        dueAt,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        vatTotal: totals.vatTotal,
        total: totals.total,
        buyerName: d.buyerName,
        buyerAddress: d.buyerAddress ?? null,
        buyerEmail: d.buyerEmail ?? null,
        buyerCompany: d.buyerCompany ?? null,
        buyerCui: d.buyerCui ?? null,
        buyerRegCom: d.buyerRegCom ?? null,
        notes: d.notes ?? null,
        createdById: actor.id,
        items: {
          create: d.lines.map((l, i) => ({
            serviceId: l.serviceId ?? null,
            treatmentPlanItemId: l.treatmentPlanItemId ?? null,
            doctorId: l.doctorId ?? null,
            description: l.description,
            tooth: l.tooth ?? null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            vatRate: l.vatRate,
            total: totals.lines[i].total,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    await audit(
      {
        action: "invoice.create",
        entityType: "Invoice",
        entityId: invoice.id,
        patientId: d.patientId,
        metadata: { series, number, lines: d.lines.length, sources: [...new Set(d.lines.map((l) => l.source))], company: !!d.buyerCui },
      },
      { actor, db: tx },
    );

    let payment: { id: string; receipt: string | null } | null = null;
    if (d.payNow && totals.total > 0) {
      payment = await insertPayment(
        tx,
        {
          patientId: d.patientId,
          invoiceId: invoice.id,
          locationId: d.locationId,
          amount: d.payNow.amount ?? totals.total,
          method: d.payNow.method,
          paidAt: issuedAt,
          reference: d.payNow.reference ?? null,
        },
        actor,
        invoicing.receiptSeries,
      );
    }
    return { id: invoice.id, number: formatDocNumber(series, number), payment };
  });
}

/**
 * ADMIN only. Sets ANULATA with the reason; the invoice's payments are detached (invoiceId → null)
 * and so become credit on account. Plan lines on it become billable again.
 */
export async function cancelInvoice(
  id: string,
  reason: string,
  actor: CurrentUser,
): Promise<{ id: string; patientId: string; detachedPayments: number }> {
  if (!can(actor, "billing.cancel")) throw new DomainError("FORBIDDEN", "Doar administratorul poate anula o factură.");
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id }, select: { id: true, status: true, patientId: true } });
    if (!inv) throw new DomainError("NOT_FOUND", "Factura nu există.");
    if (inv.status === "ANULATA") throw new DomainError("VALIDATION", "Factura este deja anulată.");
    const detached = await tx.payment.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
    await tx.invoice.update({
      where: { id },
      data: { status: "ANULATA", cancelledAt: new Date(), cancelledById: actor.id, cancelReason: reason, amountPaid: 0 },
    });
    await audit(
      {
        action: "invoice.cancel",
        entityType: "Invoice",
        entityId: id,
        patientId: inv.patientId,
        metadata: { fields: ["status", "cancelReason"], detachedPayments: detached.count },
      },
      { actor, db: tx },
    );
    return { id, patientId: inv.patientId, detachedPayments: detached.count };
  });
}
