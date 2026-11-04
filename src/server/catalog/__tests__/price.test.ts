import { describe, expect, it } from "vitest";
import { formatPriceText, parsePriceText } from "../price";

describe("parsePriceText", () => {
  it("accepts the three catalog forms", () => {
    expect(parsePriceText("1.200")).toEqual({ ok: true, value: { priceMin: 120000, priceMax: null, priceFrom: false } });
    expect(parsePriceText("900 / 1.100")).toEqual({ ok: true, value: { priceMin: 90000, priceMax: 110000, priceFrom: false } });
    expect(parsePriceText("de la 200")).toEqual({ ok: true, value: { priceMin: 20000, priceMax: null, priceFrom: true } });
  });

  it("tolerates „lei”, decimals, dashes and extra spaces", () => {
    expect(parsePriceText(" De la 1.200 lei ")).toEqual({ ok: true, value: { priceMin: 120000, priceMax: null, priceFrom: true } });
    expect(parsePriceText("150,50 lei")).toMatchObject({ ok: true, value: { priceMin: 15050 } });
    expect(parsePriceText("900 – 1.100")).toMatchObject({ ok: true, value: { priceMin: 90000, priceMax: 110000 } });
    expect(parsePriceText("900/1100")).toMatchObject({ ok: true, value: { priceMin: 90000, priceMax: 110000 } });
  });

  it("treats blank as „price at consultation”", () => {
    expect(parsePriceText("")).toEqual({ ok: true, value: { priceMin: null, priceMax: null, priceFrom: false } });
    expect(parsePriceText(null)).toMatchObject({ ok: true, value: { priceMin: null } });
  });

  it("rejects garbage and inverted ranges", () => {
    expect(parsePriceText("abc").ok).toBe(false);
    expect(parsePriceText("1.100 / 900").ok).toBe(false);
    expect(parsePriceText("de la 200 / 300").ok).toBe(false);
    expect(parsePriceText("-200").ok).toBe(false);
    expect(parsePriceText("1 / 2 / 3").ok).toBe(false);
  });
});

describe("formatPriceText", () => {
  it("round-trips", () => {
    for (const s of ["1.200", "900 / 1.100", "de la 200", "", "150,50"]) {
      const r = parsePriceText(s);
      if (!r.ok) throw new Error(s);
      expect(formatPriceText(r.value)).toBe(s);
    }
  });
});
