import { describe, expect, it } from "vitest";
import {
  NBSP,
  ageFromBirthDate,
  capitalize,
  formatAmount,
  formatDateRo,
  formatDateTime,
  formatLei,
  formatPhone,
  formatTime,
  formatYears,
  maskCnp,
  personName,
  pluralRo,
  telHref,
} from "../format";

/** Writes the expected text with ordinary spaces where the formatter puts no-break spaces. */
const nb = (s: string) => s.replace(/~/g, NBSP);

describe("formatLei", () => {
  it("uses a no-break space", () => {
    expect(NBSP).toBe(" ");
  });

  it("formats whole amounts with Romanian grouping", () => {
    expect(formatLei(220000)).toBe(nb("2.200~lei"));
    expect(formatLei(20000)).toBe(nb("200~lei"));
    expect(formatLei(1500000)).toBe(nb("15.000~lei"));
    expect(formatLei(0)).toBe(nb("0~lei"));
  });

  it("shows bani only when there are any", () => {
    expect(formatLei(120050)).toBe(nb("1.200,50~lei"));
    expect(formatLei(1205)).toBe(nb("12,05~lei"));
  });

  it("formats „de la”, ranges and units", () => {
    expect(formatLei(20000, { from: true })).toBe(nb("de la 200~lei"));
    expect(formatLei(90000, { max: 110000 })).toBe(nb("900 / 1.100~lei"));
    expect(formatLei(90000, { max: 120000 })).toBe(nb("900 / 1.200~lei"));
    expect(formatLei(15000, { unit: "ORA" })).toBe(nb("150~lei / oră"));
    expect(formatLei(10000, { max: 15000, unit: "SEDINTA" })).toBe(nb("100 / 150~lei / ședință"));
  });

  it("ignores a maximum equal to the minimum and units without a suffix", () => {
    expect(formatLei(55000, { max: 55000 })).toBe(nb("550~lei"));
    expect(formatLei(55000, { max: null, unit: "DINTE" })).toBe(nb("550~lei"));
    expect(formatLei(55000, { unit: "ACT" })).toBe(nb("550~lei"));
  });

  it("asks the visitor to call when there is no price", () => {
    expect(formatLei(null)).toBe("Prețul îl aflați la telefon");
  });

  it("formats bare amounts", () => {
    expect(formatAmount(220000)).toBe("2.200");
    expect(formatAmount(120050)).toBe("1.200,50");
  });
});

describe("dates and times (Europe/Bucharest)", () => {
  const tuesday = new Date("2026-10-06T07:30:00Z"); // 10:30 local

  it("formats the long, short, weekday and full styles", () => {
    expect(formatDateRo(tuesday)).toBe("marți, 6 octombrie");
    expect(formatDateRo(tuesday, "long")).toBe("marți, 6 octombrie");
    expect(formatDateRo(tuesday, "short")).toBe("06.10.2026");
    expect(formatDateRo(tuesday, "weekday")).toBe("mar. 6 oct.");
    expect(formatDateRo(tuesday, "full")).toBe("marți, 6 octombrie 2026");
  });

  it("accepts ISO local dates and ISO instants", () => {
    expect(formatDateRo("2026-12-01")).toBe("marți, 1 decembrie");
    expect(formatDateRo("2026-10-06T22:30:00Z")).toBe("miercuri, 7 octombrie");
    expect(formatDateRo("2026-10-11", "weekday")).toBe("dum. 11 oct.");
  });

  it("shows the local date of a late UTC evening", () => {
    expect(formatDateRo(new Date("2026-10-06T22:30:00Z"), "short")).toBe("07.10.2026");
  });

  it("uses comma-below diacritics only", () => {
    const all = [
      formatDateRo("2026-10-06"),
      formatDateRo("2026-10-10"),
      formatDateRo("2026-10-10", "weekday"),
      formatLei(15000, { unit: "ORA" }),
    ].join(" ");
    expect(all).not.toMatch(/[şţŞŢ]/);
  });

  it("formats local times, across the DST change", () => {
    expect(formatTime(tuesday)).toBe("10:30");
    expect(formatTime(new Date("2026-10-25T07:00:00Z"))).toBe("09:00");
    expect(formatTime(new Date("2026-10-24T06:00:00Z"))).toBe("09:00");
    expect(formatDateTime(tuesday)).toBe("06.10.2026, 10:30");
  });

  it("capitalises page titles", () => {
    expect(capitalize("marți, 6 octombrie")).toBe("Marți, 6 octombrie");
    expect(capitalize("înainte")).toBe("Înainte");
  });
});

describe("phones", () => {
  it("displays Romanian numbers in groups", () => {
    expect(formatPhone("+40744123456")).toBe(nb("0744~123~456"));
    expect(formatPhone("0265326316")).toBe(nb("0265~326~316"));
    expect(formatPhone("0265.326.316")).toBe(nb("0265~326~316"));
    expect(formatPhone("0040365430125")).toBe(nb("0365~430~125"));
  });

  it("returns foreign numbers as given", () => {
    expect(formatPhone("+4915112345678")).toBe("+4915112345678");
  });

  it("builds tel: links in E.164", () => {
    expect(telHref("0265 326 316")).toBe("tel:+40265326316");
    expect(telHref("+40744123456")).toBe("tel:+40744123456");
    expect(telHref("+49 151 1234 5678")).toBe("tel:+4915112345678");
  });
});

describe("people", () => {
  it("masks a CNP", () => {
    expect(maskCnp("1960523264411")).toBe("1••••••••••11");
    expect(maskCnp("23")).toBe("•••••••••••23");
  });

  it("joins names", () => {
    expect(personName({ firstName: " Maria ", lastName: "Suciu" })).toBe("Maria Suciu");
  });

  it("computes ages on the local date", () => {
    const birth = new Date("2000-10-06T00:00:00Z");
    expect(ageFromBirthDate(birth, new Date("2026-10-05T12:00:00Z"))).toBe(25);
    expect(ageFromBirthDate(birth, new Date("2026-10-06T12:00:00Z"))).toBe(26);
    // 22:00Z on 5 October is already 6 October in Romania.
    expect(ageFromBirthDate(birth, new Date("2026-10-05T22:00:00Z"))).toBe(26);
  });

  it("agrees numerals in Romanian", () => {
    expect(formatYears(1)).toBe("1 an");
    expect(formatYears(7)).toBe("7 ani");
    expect(formatYears(19)).toBe("19 ani");
    expect(formatYears(20)).toBe("20 de ani");
    expect(formatYears(101)).toBe("101 ani");
    expect(pluralRo(1, "programare", "programări")).toBe("1 programare");
    expect(pluralRo(3, "programare", "programări")).toBe("3 programări");
    expect(pluralRo(20, "programare", "programări")).toBe("20 de programări");
    expect(pluralRo(0, "programare", "programări")).toBe("0 programări");
  });
});
