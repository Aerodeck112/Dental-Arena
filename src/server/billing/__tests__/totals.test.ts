import { describe, expect, it } from "vitest";
import {
  computeBalance,
  computeInvoiceTotals,
  formatDocNumber,
  invoicePaymentState,
  lineProblems,
  lineTotals,
  openAmount,
  paymentProblems,
  sumActivePayments,
} from "../totals";

const line = (o: Partial<{ quantity: number; unitPrice: number; discount: number; vatRate: number }> = {}) => ({
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  vatRate: 0,
  ...o,
});

describe("lineTotals", () => {
  it("is quantity × unitPrice − discount with VAT 0", () => {
    expect(lineTotals(line({ quantity: 2, unitPrice: 25000, discount: 5000 }))).toEqual({
      gross: 50000,
      discount: 5000,
      net: 45000,
      vat: 0,
      total: 45000,
    });
  });

  it("adds VAT on the net and rounds half-up per line", () => {
    // 3 × 33,33 lei = 99,99 lei; 19% = 18,9981 lei → 19,00 lei
    expect(lineTotals(line({ quantity: 3, unitPrice: 3333, vatRate: 19 }))).toMatchObject({ net: 9999, vat: 1900, total: 11899 });
    expect(lineTotals(line({ unitPrice: 50, vatRate: 1 })).vat).toBe(1); // 0,5 bani → 1
  });
});

describe("computeInvoiceTotals", () => {
  it("sums subtotal, discounts and VAT across lines", () => {
    const t = computeInvoiceTotals([
      line({ quantity: 1, unitPrice: 300000 }), // implant 3.000 lei
      line({ quantity: 2, unitPrice: 25000, discount: 10000 }), // 2 × 250 lei − 100 lei
      line({ quantity: 1, unitPrice: 10000, vatRate: 19 }),
    ]);
    expect(t.subtotal).toBe(360000);
    expect(t.discountTotal).toBe(10000);
    expect(t.vatTotal).toBe(1900);
    expect(t.total).toBe(t.subtotal - t.discountTotal + t.vatTotal);
    expect(t.total).toBe(t.lines.reduce((s, l) => s + l.total, 0));
  });

  it("handles an empty list", () => {
    expect(computeInvoiceTotals([])).toMatchObject({ subtotal: 0, discountTotal: 0, vatTotal: 0, total: 0 });
  });
});

describe("lineProblems", () => {
  it("accepts a valid line", () => {
    expect(lineProblems({ ...line({ unitPrice: 1000 }), description: "Detartraj" })).toEqual([]);
  });

  it("rejects a discount above the line value, zero quantity, negative prices and blank text", () => {
    expect(lineProblems(line({ unitPrice: 1000, discount: 1001 }))).toContain("Reducerea nu poate depăși valoarea liniei.");
    expect(lineProblems(line({ quantity: 0 }))).toContain("Cantitatea este între 1 și 999.");
    expect(lineProblems(line({ unitPrice: -1 }))).toContain("Prețul nu poate fi negativ.");
    expect(lineProblems(line({ vatRate: 101 }))).toContain("Cota TVA este între 0 și 100.");
    expect(lineProblems({ ...line(), description: "  " })).toContain("Completați descrierea.");
    expect(lineProblems(line({ unitPrice: 10.5 }))).toContain("Prețul nu poate fi negativ.");
  });
});

describe("payments and balance", () => {
  it("sums only non-cancelled payments", () => {
    expect(
      sumActivePayments([
        { amount: 10000 },
        { amount: 5000, cancelledAt: new Date() },
        { amount: 2500, cancelledAt: null },
      ]),
    ).toBe(12500);
  });

  it("computes the balance: positive owes, negative is credit", () => {
    expect(computeBalance(100000, 40000)).toEqual({ invoiced: 100000, paid: 40000, balance: 60000 });
    expect(computeBalance(0, 20000).balance).toBe(-20000);
  });

  it("open amount is never negative", () => {
    expect(openAmount(10000, 4000)).toBe(6000);
    expect(openAmount(10000, 12000)).toBe(0);
  });

  it("derives the payment state", () => {
    expect(invoicePaymentState({ status: "ANULATA", total: 100, amountPaid: 0 })).toBe("ANULATA");
    expect(invoicePaymentState({ status: "EMISA", total: 100, amountPaid: 0 })).toBe("NEPLATITA");
    expect(invoicePaymentState({ status: "EMISA", total: 100, amountPaid: 40 })).toBe("PARTIAL");
    expect(invoicePaymentState({ status: "EMISA", total: 100, amountPaid: 100 })).toBe("PLATITA");
    expect(invoicePaymentState({ status: "EMISA", total: 0, amountPaid: 0 })).toBe("PLATITA");
  });

  it("checks payment amounts against the open amount", () => {
    expect(paymentProblems({ amount: 5000, open: 5000 })).toEqual([]);
    expect(paymentProblems({ amount: 5001, open: 5000 })).toEqual(["Suma depășește restul de plată al facturii."]);
    expect(paymentProblems({ amount: 0 })).toEqual(["Suma trebuie să fie mai mare decât 0."]);
    expect(paymentProblems({ amount: 999999, open: null })).toEqual([]);
  });
});

describe("formatDocNumber", () => {
  it("pads to six digits", () => {
    expect(formatDocNumber("DA", 1)).toBe("DA-000001");
    expect(formatDocNumber("DAC", 1234567)).toBe("DAC-1234567");
  });
});
