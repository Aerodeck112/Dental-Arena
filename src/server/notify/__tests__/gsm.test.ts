import { describe, expect, it } from "vitest";
import { isGsm7, smsInfo, toGsm7 } from "../gsm";

describe("toGsm7", () => {
  it("transliterates Romanian letters, comma-below and cedilla forms", () => {
    expect(toGsm7("ăâîșț ĂÂÎȘȚ şţŞŢ")).toBe("aaist AAIST stST");
  });

  it("replaces Romanian quotes, dashes, ellipsis and no-break spaces", () => {
    expect(toGsm7("„Mi-e frică” – 3–6 luni… 0265 326 316")).toBe('"Mi-e frica" - 3-6 luni... 0265 326 316');
  });

  it("keeps the GSM-7 basic and extension characters and marks anything else with ?", () => {
    expect(toGsm7("Preț: 150€ [ok] {x} ~ é")).toBe("Pret: 150€ [ok] {x} ~ é");
    expect(toGsm7("Zâmbet 😀")).toBe("Zambet ?");
  });

  it("turns the default reminder into pure GSM-7", () => {
    const text = toGsm7(
      "Dental Arena: vă reamintim programarea de marți, 7 octombrie, ora 10:30, la Dental Arena Cristești. Confirmați sau anulați: https://dentalarena.ro/p/abc.0.t3k9z1.sig",
    );
    expect(isGsm7(text)).toBe(true);
    expect(text).toContain("va reamintim programarea de marti, 7 octombrie");
    expect(text).toContain("Cristesti");
  });
});

describe("smsInfo", () => {
  it("counts GSM-7 at 160 per single segment and 153 when concatenated", () => {
    expect(smsInfo("a".repeat(160))).toEqual({ encoding: "GSM-7", units: 160, segments: 1, perSegment: 160 });
    expect(smsInfo("a".repeat(161))).toMatchObject({ segments: 2, perSegment: 153 });
    expect(smsInfo("a".repeat(306))).toMatchObject({ segments: 2 });
    expect(smsInfo("a".repeat(307))).toMatchObject({ segments: 3 });
  });

  it("counts extension characters twice", () => {
    expect(smsInfo("€").units).toBe(2);
    expect(smsInfo("[]").units).toBe(4);
  });

  it("falls back to UCS-2 (70 / 67) when diacritics remain", () => {
    expect(smsInfo("ș".repeat(70))).toEqual({ encoding: "UCS-2", units: 70, segments: 1, perSegment: 70 });
    expect(smsInfo("ș".repeat(71))).toMatchObject({ encoding: "UCS-2", segments: 2, perSegment: 67 });
  });

  it("has no segments for an empty text", () => {
    expect(smsInfo("").segments).toBe(0);
  });
});
