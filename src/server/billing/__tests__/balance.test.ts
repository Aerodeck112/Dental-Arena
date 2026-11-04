import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp8.db";
});

import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { getPatientBalance, getPatientBalancesBulk } from "../balance";
import { cancelInvoice, createInvoice, getInvoiceCandidates } from "../invoices";
import { cancelPayment, getPaymentJournal, recordPayment } from "../payments";

const tag = `bal${process.pid}${Date.now().toString(36)}`;
let fileNo = 900_000 + Math.floor(Math.random() * 90_000);

const admin: CurrentUser = {
  id: `${tag}admin`,
  role: "ADMIN",
  email: `${tag}@example.com`,
  firstName: "Ana",
  lastName: "Admin",
  displayName: "Ana Admin",
  doctorId: null,
  homeLocationId: null,
  locationIds: [],
  theme: "SISTEM",
  density: "COMPACT",
  mustChangePassword: false,
};
const receptie: CurrentUser = { ...admin, id: `${tag}rec`, role: "RECEPTIE", displayName: "Rita Recepție" };

let locationId = "";
let serviceId = "";
let categoryId = "";

async function newPatient(name: string) {
  fileNo += 1;
  return prisma.patient.create({
    data: { fileNumber: fileNo, firstName: name, lastName: "Test", searchText: `${name.toLowerCase()} test` },
    select: { id: true },
  });
}

const freeLine = (unitPrice: number, o: Partial<{ quantity: number; discount: number }> = {}) => ({
  source: "LIBER" as const,
  description: "Tratament",
  quantity: o.quantity ?? 1,
  unitPrice,
  discount: o.discount ?? 0,
  vatRate: 0,
});

beforeAll(async () => {
  const loc = await prisma.location.create({
    data: { slug: `${tag}-loc`, name: "Dental Arena Test", shortName: "Test", street: "str. Test 1", city: "Târgu Mureș", phone: "0265 000 000" },
  });
  locationId = loc.id;
  const cat = await prisma.serviceCategory.create({ data: { slug: `${tag}-cat`, name: "Test" } });
  categoryId = cat.id;
  serviceId = (await prisma.service.create({ data: { categoryId, code: `${tag}-SVC`, name: "Detartraj", priceMin: 25000 } })).id;
});

describe("getPatientBalance", () => {
  it("is zero for a patient with no invoices or payments", async () => {
    const p = await newPatient("Zero");
    expect(await getPatientBalance(p.id)).toEqual({ invoiced: 0, paid: 0, balance: 0 });
  });

  it("follows invoices, partial payments, payment cancellation and invoice cancellation", async () => {
    const p = await newPatient("Maria");
    const inv = await createInvoice(
      { patientId: p.id, locationId, buyerName: "Maria Test", lines: [freeLine(100000), freeLine(25000, { quantity: 2, discount: 10000 })] },
      receptie,
    );
    expect(inv.number).toMatch(/^DA-\d{6}$/);
    let stored = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(stored).toMatchObject({ subtotal: 150000, discountTotal: 10000, vatTotal: 0, total: 140000, amountPaid: 0 });
    expect(await getPatientBalance(p.id)).toEqual({ invoiced: 140000, paid: 0, balance: 140000 });

    // Partial cash payment: gets a DAC receipt, amountPaid recomputed in the same transaction.
    const cash = await recordPayment({ patientId: p.id, invoiceId: inv.id, amount: 40000, method: "NUMERAR" }, receptie);
    expect(cash.receipt).toMatch(/^DAC-\d{6}$/);
    const card = await recordPayment({ patientId: p.id, invoiceId: inv.id, amount: 30000, method: "CARD" }, receptie);
    expect(card.receipt).toBeNull();
    stored = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(stored.amountPaid).toBe(70000);
    expect(await getPatientBalance(p.id)).toEqual({ invoiced: 140000, paid: 70000, balance: 70000 });

    // Overpaying an invoice is refused.
    await expect(recordPayment({ patientId: p.id, invoiceId: inv.id, amount: 70001, method: "CARD" }, receptie)).rejects.toMatchObject({
      code: "VALIDATION",
    });

    // Cancelling a payment is ADMIN only and lowers amountPaid.
    await expect(cancelPayment(card.id, "Greșeală", receptie)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await cancelPayment(card.id, "Greșeală de operare", admin);
    stored = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(stored.amountPaid).toBe(40000);
    expect(await getPatientBalance(p.id)).toEqual({ invoiced: 140000, paid: 40000, balance: 100000 });

    // Cancelling the invoice detaches its payments, which become credit on account.
    await expect(cancelInvoice(inv.id, "Date greșite", receptie)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const c = await cancelInvoice(inv.id, "Date greșite pe factură", admin);
    expect(c.detachedPayments).toBe(2);
    stored = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(stored).toMatchObject({ status: "ANULATA", amountPaid: 0, cancelReason: "Date greșite pe factură" });
    expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(0);
    expect(await getPatientBalance(p.id)).toEqual({ invoiced: 0, paid: 40000, balance: -40000 });

    const audits = await prisma.auditLog.findMany({ where: { patientId: p.id }, select: { action: true } });
    expect(audits.map((a) => a.action).sort()).toEqual(
      ["invoice.cancel", "invoice.create", "payment.cancel", "payment.create", "payment.create"].sort(),
    );
  });

  it("records an immediate payment in the same transaction and numbers invoices without gaps", async () => {
    const p = await newPatient("Ion");
    const a = await createInvoice(
      { patientId: p.id, locationId, buyerName: "Ion Test", lines: [freeLine(50000)], payNow: { method: "TRANSFER" } },
      receptie,
    );
    expect(a.payment).not.toBeNull();
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: a.id } })).amountPaid).toBe(50000);
    // A failed invoice (discount above value) must not burn a number.
    await expect(
      createInvoice({ patientId: p.id, locationId, buyerName: "Ion Test", lines: [freeLine(1000, { discount: 2000 })] }, receptie),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const b = await createInvoice({ patientId: p.id, locationId, buyerName: "Ion Test", lines: [freeLine(1000)] }, receptie);
    const na = Number(a.number.slice(3));
    const nb = Number(b.number.slice(3));
    expect(nb).toBeGreaterThan(na);
    const between = await prisma.invoice.count({ where: { series: "DA", number: { gt: na, lt: nb } } });
    expect(between).toBe(nb - na - 1); // every number in between belongs to an existing invoice

    // Payment on account (no invoice) counts as credit.
    await recordPayment({ patientId: p.id, amount: 20000, method: "NUMERAR", locationId }, receptie);
    expect(await getPatientBalance(p.id)).toEqual({ invoiced: 51000, paid: 70000, balance: -19000 });

    const bulk = await getPatientBalancesBulk([p.id, "lipsa"]);
    expect(bulk.get(p.id)?.balance).toBe(-19000);
    expect(bulk.get("lipsa")).toEqual({ invoiced: 0, paid: 0, balance: 0 });
  });

  it("offers accepted plan items once, and not again after they are invoiced", async () => {
    const p = await newPatient("Elena");
    const plan = await prisma.treatmentPlan.create({
      data: {
        patientId: p.id,
        title: "Plan test",
        status: "ACCEPTAT",
        items: {
          create: [
            { description: "Detartraj", serviceId, unitPrice: 25000, status: "ACCEPTAT" },
            { description: "Obturație", unitPrice: 30000, status: "PROPUS" },
          ],
        },
      },
      include: { items: true },
    });
    const accepted = plan.items.find((i) => i.status === "ACCEPTAT")!;
    let c = await getInvoiceCandidates(p.id);
    expect(c.plan.map((x) => x.treatmentPlanItemId)).toEqual([accepted.id]);

    const line = { ...freeLine(25000), source: "PLAN" as const, treatmentPlanItemId: accepted.id, serviceId };
    const inv = await createInvoice({ patientId: p.id, locationId, buyerName: "Elena Test", lines: [line] }, receptie);
    c = await getInvoiceCandidates(p.id);
    expect(c.plan).toEqual([]);
    await expect(
      createInvoice({ patientId: p.id, locationId, buyerName: "Elena Test", lines: [line] }, receptie),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // A proposed (not accepted) item is refused.
    const proposed = plan.items.find((i) => i.status === "PROPUS")!;
    await expect(
      createInvoice({ patientId: p.id, locationId, buyerName: "Elena Test", lines: [{ ...line, treatmentPlanItemId: proposed.id }] }, receptie),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // After cancellation the line is billable again.
    await cancelInvoice(inv.id, "Refacere factură", admin);
    c = await getInvoiceCandidates(p.id);
    expect(c.plan.map((x) => x.treatmentPlanItemId)).toEqual([accepted.id]);
  });

  it("journal totals per method and location skip cancelled payments", async () => {
    const p = await newPatient("Jurnal");
    const from = new Date(Date.now() - 60_000);
    await recordPayment({ patientId: p.id, amount: 10000, method: "NUMERAR", locationId }, receptie);
    await recordPayment({ patientId: p.id, amount: 5000, method: "CARD", locationId }, receptie);
    const x = await recordPayment({ patientId: p.id, amount: 7000, method: "CARD", locationId }, receptie);
    await cancelPayment(x.id, "Dublură", admin);
    const j = await getPaymentJournal({ from, to: new Date(Date.now() + 60_000), locationIds: [locationId] });
    const mine = j.rows.filter((r) => r.patientId === p.id);
    expect(mine).toHaveLength(3);
    expect(mine.filter((r) => r.cancelled)).toHaveLength(1);
    const loc = j.byLocation.find((l) => l.locationId === locationId)!;
    expect(loc.byMethod.NUMERAR).toBeGreaterThanOrEqual(10000);
    expect(j.total).toBe(j.byMethod.NUMERAR + j.byMethod.CARD + j.byMethod.TRANSFER);
  });
});

describe("listInvoices", () => {
  it("filters unpaid invoices in the database and sums only issued ones", async () => {
    const { listInvoices } = await import("../invoices");
    const p = await newPatient("Lista");
    const paid = await createInvoice({ patientId: p.id, locationId, buyerName: "Lista Test", lines: [freeLine(10000)], payNow: { method: "CARD" } }, receptie);
    const open = await createInvoice({ patientId: p.id, locationId, buyerName: "Lista Test", lines: [freeLine(30000)] }, receptie);
    const cancelled = await createInvoice({ patientId: p.id, locationId, buyerName: "Lista Test", lines: [freeLine(5000)] }, receptie);
    await cancelInvoice(cancelled.id, "Test listă", admin);
    const all = await listInvoices({ locationIds: [locationId], patientId: p.id });
    expect(all.count).toBe(3);
    expect(all.sums).toEqual({ total: 40000, amountPaid: 10000, open: 30000 });
    const unpaid = await listInvoices({ locationIds: [locationId], patientId: p.id, status: "NEPLATITE" });
    expect(unpaid.rows.map((r) => r.id)).toEqual([open.id]);
    expect(unpaid.rows[0].paymentState).toBe("NEPLATITA");
    const byNumber = await listInvoices({ locationIds: [locationId], q: paid.number });
    expect(byNumber.rows.map((r) => r.id)).toContain(paid.id);
  });
});
