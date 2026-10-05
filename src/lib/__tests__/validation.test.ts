import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cnpControlDigit,
  isFdiTooth,
  isValidCnp,
  normalizePhone,
  optionalField,
  parseLei,
  zCheckbox,
  zCnp,
  zDateISO,
  zEmail,
  zId,
  zLei,
  zOptionalEmail,
  zOptionalText,
  zPhoneRo,
  zText,
  zTimeHHMM,
  zToothFdi,
} from "../validation/common";

/** The first error message of a failed parse. */
function messageOf(schema: z.ZodType, value: unknown): string | undefined {
  const r = schema.safeParse(value);
  return r.success ? undefined : r.error.issues[0]?.message;
}

describe("zPhoneRo", () => {
  it.each([
    ["0744 123 456", "+40744123456"],
    ["0744123456", "+40744123456"],
    ["+40 744 123 456", "+40744123456"],
    ["0040 744 123 456", "+40744123456"],
    ["40744123456", "+40744123456"],
    ["0265.326.316", "+40265326316"],
    ["0365-430-125", "+40365430125"],
  ])("normalises „%s” to %s", (input, expected) => {
    expect(zPhoneRo.parse(input)).toBe(expected);
    expect(normalizePhone(input)).toBe(expected);
  });

  it("keeps valid foreign numbers in E.164", () => {
    expect(zPhoneRo.parse("+49 151 1234 5678")).toBe("+4915112345678");
    expect(zPhoneRo.parse("0049 151 1234 5678")).toBe("+4915112345678");
  });

  it.each(["", "12345", "0744 123 45", "0144123456", "07441234567", "telefon", "+40 744", "0744 123 456 ext 2"])(
    "rejects „%s” with the Romanian example message",
    (input) => {
      expect(messageOf(zPhoneRo, input)).toBe("Introduceți un număr de telefon, de exemplu 0745 123 456.");
    },
  );
});

describe("zEmail", () => {
  it("trims and lowercases", () => {
    expect(zEmail.parse("  Ana.Pop@Example.RO ")).toBe("ana.pop@example.ro");
  });

  it("rejects invalid and over-long addresses", () => {
    expect(messageOf(zEmail, "ana@")).toBe("Introduceți o adresă de e-mail validă, de exemplu nume@exemplu.ro.");
    expect(zEmail.safeParse(`${"a".repeat(250)}@x.ro`).success).toBe(false);
  });

  it("treats an empty optional e-mail as missing", () => {
    expect(zOptionalEmail.parse("")).toBeUndefined();
    expect(zOptionalEmail.parse("   ")).toBeUndefined();
    expect(zOptionalEmail.parse(undefined)).toBeUndefined();
    expect(zOptionalEmail.parse("Ion@Example.com")).toBe("ion@example.com");
    expect(zOptionalEmail.safeParse("nu-e-email").success).toBe(false);
  });
});

describe("CNP", () => {
  // Hand-computed with the weights 279146358279: 1960523264411 = male, 23 May 1996, Mureș (26).
  const VALID = ["1960523264411", "6100214260012"];

  it("computes the control digit", () => {
    expect(cnpControlDigit("196052326441")).toBe(1); // sum 263, 263 % 11 = 10 → 1
    expect(cnpControlDigit("610021426001")).toBe(2); // sum 112, 112 % 11 = 2
  });

  it.each(VALID)("accepts %s", (cnp) => {
    expect(isValidCnp(cnp)).toBe(true);
    expect(zCnp.parse(cnp)).toBe(cnp);
  });

  it("ignores spaces", () => {
    expect(zCnp.parse("1960523 264411")).toBe("1960523264411");
  });

  it.each([
    ["1960523264412", "wrong control digit"],
    ["0960523264411", "sex digit 0"],
    ["1960230264411", "30 February"],
    ["1961323264411", "month 13"],
    ["1960523994411", "county 99"],
    ["196052326441", "12 digits"],
    ["19605232644111", "14 digits"],
    ["196052326441a", "a letter"],
  ])("rejects %s (%s)", (cnp) => {
    expect(isValidCnp(cnp.replace(/\s/g, ""))).toBe(false);
    expect(messageOf(zCnp, cnp)).toBe("CNP-ul nu este valid.");
  });
});

describe("zLei (lei → bani)", () => {
  it.each<[string | number, number]>([
    ["1.200,50", 120050],
    ["1200", 120000],
    ["1.200", 120000],
    ["1200,5", 120050],
    ["12.5", 1250],
    ["2.200", 220000],
    ["15.000", 1500000],
    ["0", 0],
    ["1 200 lei", 120000],
    [1200, 120000],
    [12.5, 1250],
  ])("parses %s as %i bani", (input, bani) => {
    expect(zLei.parse(input)).toBe(bani);
    expect(parseLei(input)).toBe(bani);
  });

  it.each(["", "-5", "abc", "1,2,3", "12,345", "1.20.0", "1.200,505"])("rejects „%s”", (input) => {
    expect(messageOf(zLei, input)).toBe("Introduceți o sumă, de exemplu 1.200 sau 1.200,50.");
  });

  it("rejects negative numbers", () => {
    expect(zLei.safeParse(-1).success).toBe(false);
  });
});

describe("dates, times and teeth", () => {
  it("validates ISO dates", () => {
    expect(zDateISO.parse(" 2028-02-29 ")).toBe("2028-02-29");
    expect(messageOf(zDateISO, "2026-02-29")).toBe("Introduceți o dată validă.");
    expect(zDateISO.safeParse("06.10.2026").success).toBe(false);
  });

  it("parses HH:MM to minutes", () => {
    expect(zTimeHHMM.parse("09:30")).toBe(570);
    expect(zTimeHHMM.parse("19:00")).toBe(1140);
    expect(messageOf(zTimeHHMM, "25:00")).toBe("Introduceți ora, de exemplu 09:30.");
  });

  it("accepts FDI tooth numbers only", () => {
    for (const ok of [11, 18, 21, 28, 31, 38, 41, 48, 51, 55, 61, 65, 71, 75, 81, 85]) {
      expect(isFdiTooth(ok)).toBe(true);
    }
    for (const bad of [10, 19, 29, 49, 50, 56, 66, 86, 91, 36.5]) {
      expect(isFdiTooth(bad)).toBe(false);
    }
    expect(zToothFdi.parse("36")).toBe(36);
    expect(zToothFdi.safeParse("19").success).toBe(false);
  });
});

describe("text and checkboxes", () => {
  it("trims text and strips control characters", () => {
    expect(zText(20).parse("  Maria\u0007 Suciu\u0000 ")).toBe("Maria Suciu");
    expect(zText(20).parse("rând 1\r\nrând 2\ttab")).toBe("rând 1\nrând 2\ttab");
  });

  it("requires text and enforces the maximum length with Romanian agreement", () => {
    expect(messageOf(zText(10), "")).toBe("Completați acest câmp.");
    expect(messageOf(zText(10), "   ")).toBe("Completați acest câmp.");
    expect(messageOf(zText(10), "x".repeat(11))).toBe("Textul este prea lung: cel mult 10 caractere.");
    expect(messageOf(zText(80), "x".repeat(81))).toBe("Textul este prea lung: cel mult 80 de caractere.");
    expect(messageOf(zText(2000), "x".repeat(2001))).toBe("Textul este prea lung: cel mult 2000 de caractere.");
  });

  it("turns empty optional text into undefined", () => {
    expect(zOptionalText(5).parse("")).toBeUndefined();
    expect(zOptionalText(5).parse("  \u0007 ")).toBeUndefined();
    expect(zOptionalText(5).parse(undefined)).toBeUndefined();
    expect(zOptionalText(5).parse(" abc ")).toBe("abc");
    expect(zOptionalText(5).safeParse("abcdef").success).toBe(false);
  });

  it("reads checkboxes", () => {
    expect(zCheckbox.parse("on")).toBe(true);
    expect(zCheckbox.parse("true")).toBe(true);
    expect(zCheckbox.parse(true)).toBe(true);
    expect(zCheckbox.parse(["off", "on"])).toBe(true);
    expect(zCheckbox.parse(undefined)).toBe(false);
    expect(zCheckbox.parse("")).toBe(false);
    expect(zCheckbox.parse("false")).toBe(false);
  });

  it("makes any schema optional for blank form fields", () => {
    const phone = optionalField(zPhoneRo);
    expect(phone.parse("")).toBeUndefined();
    expect(phone.parse("0744 123 456")).toBe("+40744123456");
  });
});

describe("zId", () => {
  it("accepts cuid-like ids and rejects anything else", () => {
    expect(zId.parse("cmgd3k2x40000qz8l5f1h2j3k")).toBe("cmgd3k2x40000qz8l5f1h2j3k");
    expect(zId.safeParse("abc").success).toBe(false);
    expect(zId.safeParse("cmgd3k2x40000qz8l5f1h2j3k'; drop").success).toBe(false);
    expect(zId.safeParse(42).success).toBe(false);
  });
});
