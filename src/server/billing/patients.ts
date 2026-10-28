import "server-only";
import { prisma } from "@/lib/db";
import { formatPhone, personName } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { getSettings } from "@/lib/settings";
import { listServiceOptions } from "@/server/catalog/service";
import { getInvoiceCandidates } from "./invoices";
import { openAmount, formatDocNumber } from "./totals";

/**
 * Patient lookups for the billing screens (WP8): a small search to pick the patient of a new
 * invoice or payment, the buyer prefill, and the open invoices for the payment form. DTOs only.
 */

export type BillingPatientHit = { id: string; name: string; fileNumber: number; phone: string | null; anonymized: boolean };

export async function searchBillingPatients(q: string, take = 10): Promise<BillingPatientHit[]> {
  const text = normalizeSearch(q);
  if (text.length < 2) return [];
  const digits = q.replace(/\D/g, "");
  const rows = await prisma.patient.findMany({
    where: {
      OR: [{ searchText: { contains: text } }, ...(digits.length >= 3 && digits.length <= 7 ? [{ fileNumber: Number(digits) }] : [])],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true, anonymizedAt: true },
  });
  return rows.map((p) => ({
    id: p.id,
    name: personName(p),
    fileNumber: p.fileNumber,
    phone: p.phone ? formatPhone(p.phone) : null,
    anonymized: p.anonymizedAt !== null,
  }));
}

export type BillingPatient = {
  id: string;
  name: string;
  fileNumber: number;
  buyerName: string;
  buyerAddress: string | null;
  buyerEmail: string | null;
  preferredLocationId: string | null;
  anonymized: boolean;
};

export async function getBillingPatient(id: string): Promise<BillingPatient | null> {
  const p = await prisma.patient.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
      street: true,
      city: true,
      county: true,
      email: true,
      preferredLocationId: true,
      anonymizedAt: true,
      guardian: { select: { firstName: true, lastName: true } },
    },
  });
  if (!p) return null;
  const address = [p.street, p.city, p.county ? `jud. ${p.county}` : null].filter(Boolean).join(", ");
  return {
    id: p.id,
    name: personName(p),
    fileNumber: p.fileNumber,
    // A minor's invoice goes to the parent or guardian who pays; reception can still edit it.
    buyerName: p.guardian ? personName(p.guardian) : personName(p),
    buyerAddress: address || null,
    buyerEmail: p.email,
    preferredLocationId: p.preferredLocationId,
    anonymized: p.anonymizedAt !== null,
  };
}

/** Open (EMISA, not fully paid) invoices of a patient, oldest first, for the payment form. */
export async function listOpenInvoices(patientId: string): Promise<{ id: string; number: string; open: number; locationId: string }[]> {
  const rows = await prisma.invoice.findMany({
    where: { patientId, status: "EMISA" },
    orderBy: [{ issuedAt: "asc" }],
    select: { id: true, series: true, number: true, total: true, amountPaid: true, locationId: true },
  });
  return rows
    .filter((r) => r.amountPaid < r.total)
    .map((r) => ({ id: r.id, number: formatDocNumber(r.series, r.number), open: openAmount(r.total, r.amountPaid), locationId: r.locationId }));
}

export async function getInvoiceFormData(patientId: string, scopeLocationIds: string[]) {
  const [patient, locations, doctors, services, candidates, invoicing] = await Promise.all([
    getBillingPatient(patientId),
    prisma.location.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, shortName: true } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }], select: { id: true, publicName: true } }),
    listServiceOptions(),
    getInvoiceCandidates(patientId),
    getSettings("invoicing"),
  ]);
  if (!patient) return null;
  const defaultLocationId =
    (patient.preferredLocationId && scopeLocationIds.includes(patient.preferredLocationId) ? patient.preferredLocationId : null) ??
    scopeLocationIds[0] ??
    locations[0]?.id ??
    null;
  return {
    patient,
    locations,
    defaultLocationId,
    doctors: doctors.map((d) => ({ id: d.id, name: d.publicName })),
    services,
    candidates,
    vatRate: invoicing.defaultVatRate,
    vatNote: invoicing.vatExemptionNote,
  };
}
