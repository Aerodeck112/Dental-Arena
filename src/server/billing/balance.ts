import "server-only";
import { prisma, type Db } from "@/lib/db";
import { computeBalance } from "./totals";

/**
 * Patient balance (docs/architecture.md §3.2 invariant 4, contract §7.3):
 * Σ total of non-cancelled invoices − Σ amount of non-cancelled payments.
 * A positive balance means the patient owes money; a negative one is credit on account.
 * Payments detached from a cancelled invoice stay counted, so they become credit.
 */
export async function getPatientBalance(
  patientId: string,
  db: Db = prisma,
): Promise<{ invoiced: number; paid: number; balance: number }> {
  const [inv, pay] = await Promise.all([
    db.invoice.aggregate({ where: { patientId, status: "EMISA" }, _sum: { total: true } }),
    db.payment.aggregate({ where: { patientId, cancelledAt: null }, _sum: { amount: true } }),
  ]);
  return computeBalance(inv._sum.total ?? 0, pay._sum.amount ?? 0);
}

/** Balances for many patients in two queries (lists, the Azi „solduri” queue). Missing ids → zero balance. */
export async function getPatientBalancesBulk(
  patientIds: string[],
  db: Db = prisma,
): Promise<Map<string, { invoiced: number; paid: number; balance: number }>> {
  const out = new Map<string, { invoiced: number; paid: number; balance: number }>();
  if (patientIds.length === 0) return out;
  const [inv, pay] = await Promise.all([
    db.invoice.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds }, status: "EMISA" },
      _sum: { total: true },
    }),
    db.payment.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds }, cancelledAt: null },
      _sum: { amount: true },
    }),
  ]);
  const invoiced = new Map(inv.map((r) => [r.patientId, r._sum.total ?? 0]));
  const paid = new Map(pay.map((r) => [r.patientId, r._sum.amount ?? 0]));
  for (const id of patientIds) out.set(id, computeBalance(invoiced.get(id) ?? 0, paid.get(id) ?? 0));
  return out;
}
