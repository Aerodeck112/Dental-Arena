import { describe, expect, it } from "vitest";
import { buildPatientSearchText, normalizeSearch, normalizeSearchQuery, searchTokens } from "../search";

describe("normalizeSearch", () => {
  it("strips Romanian diacritics in both the comma-below and the cedilla forms", () => {
    expect(normalizeSearch("Mașca Ştefan")).toBe("masca stefan");
    expect(normalizeSearch("Ștefan Țurcanu")).toBe("stefan turcanu");
    expect(normalizeSearch("Şerban Ţepeş")).toBe("serban tepes");
    expect(normalizeSearch("ĂÂÎ ăâî")).toBe("aai aai");
  });

  it("lowercases, collapses whitespace and trims", () => {
    expect(normalizeSearch("  Ana\t Maria \n POP ")).toBe("ana maria pop");
  });

  it("is idempotent", () => {
    const once = normalizeSearch("Ioana Mân-Rus");
    expect(normalizeSearch(once)).toBe(once);
  });
});

describe("buildPatientSearchText", () => {
  it("contains the name, the E.164 digits, the local phone and the e-mail", () => {
    expect(
      buildPatientSearchText({ firstName: "Maria", lastName: "Suciu", phone: "+40744123456", email: "Maria@Example.com" }),
    ).toBe("maria suciu 40744123456 0744123456 maria@example.com");
  });

  it("skips missing contact data", () => {
    expect(buildPatientSearchText({ firstName: "Ștefan", lastName: "Mașca", phone: null, email: null })).toBe(
      "stefan masca",
    );
  });

  it("finds a patient by any normalised query token", () => {
    const text = buildPatientSearchText({ firstName: "Ștefan", lastName: "Mașca", phone: "+40744123456" });
    for (const q of ["Mașca", "masca stefan", "ŞTEFAN", "0744 123 456", "+40 744 123 456", "123456"]) {
      expect(searchTokens(q).every((t) => text.includes(t))).toBe(true);
    }
    expect(searchTokens("Popescu").every((t) => text.includes(t))).toBe(false);
  });
});

describe("queries", () => {
  it("turns phone-like queries into local digits", () => {
    expect(normalizeSearchQuery("0744 123 456")).toBe("0744123456");
    expect(normalizeSearchQuery("+40 744 123 456")).toBe("0744123456");
    expect(normalizeSearchQuery("0040744123456")).toBe("0744123456");
    expect(normalizeSearchQuery("0265.326.316")).toBe("0265326316");
  });

  it("normalises text queries", () => {
    expect(normalizeSearchQuery("  Suciu  Maria ")).toBe("suciu maria");
  });

  it("splits text into tokens but keeps a phone whole", () => {
    expect(searchTokens("suciu  maria")).toEqual(["suciu", "maria"]);
    expect(searchTokens("0744 123 456")).toEqual(["0744123456"]);
    expect(searchTokens("   ")).toEqual([]);
  });
});
