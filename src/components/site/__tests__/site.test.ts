import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/components/site/JsonLd";
import { hoursLines } from "@/components/site/hours";
import { parseConsent, readConsentCookie } from "@/components/site/consent";
import { dentistJsonLd } from "@/server/public/seo";
import type { PublicLocation } from "@/server/public/types";

const cristesti: PublicLocation = {
  id: "loc1",
  slug: "cristesti",
  name: "Dental Arena Cristești",
  shortName: "Cristești",
  street: "str. Principală 536J/1",
  city: "Cristești",
  county: "Mureș",
  postalCode: "547185",
  phone: "+40265326316",
  email: null,
  hours: [],
  publishHours: false,
};

describe("JSON-LD Dentist", () => {
  it("has no opening hours until the clinic publishes them", () => {
    const ld = dentistJsonLd({ ...cristesti, hours: [{ weekday: 1, openMinute: 540, closeMinute: 1020 }] });
    expect(ld["@type"]).toBe("Dentist");
    expect(ld.telephone).toBe("+40265326316");
    expect(ld).not.toHaveProperty("openingHoursSpecification");
  });

  it("lists the hours once published", () => {
    const ld = dentistJsonLd({ ...cristesti, publishHours: true, hours: [{ weekday: 2, openMinute: 540, closeMinute: 1020 }] });
    expect(ld.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Tuesday", opens: "09:00", closes: "17:00" },
    ]);
  });

  it("escapes < and line separators so a value cannot close the script", () => {
    const out = serializeJsonLd({ name: "</script><b>\u2028" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
    expect(out).toContain("\\u2028");
  });
});

describe("opening hours lines", () => {
  it("groups consecutive days with the same hours", () => {
    const h = (weekday: number, o = 540, c = 1020) => ({ weekday, openMinute: o, closeMinute: c });
    expect(hoursLines([h(1), h(2), h(3), h(4), h(5), h(6, 540, 780)])).toEqual(["Luni–vineri: 09:00–17:00", "Sâmbătă: 09:00–13:00"]);
    expect(hoursLines([h(1), h(3)])).toEqual(["Luni: 09:00–17:00", "Miercuri: 09:00–17:00"]);
  });
});

describe("cookie consent", () => {
  it("reads the da_consent cookie and ignores damaged values", () => {
    const value = encodeURIComponent(JSON.stringify({ v: 1, harti: true, at: "2026-10-06T08:00:00.000Z" }));
    expect(parseConsent(readConsentCookie(`a=1; da_consent=${value}`))).toEqual({ v: 1, harti: true, at: "2026-10-06T08:00:00.000Z" });
    expect(parseConsent(readConsentCookie("da_consent=%7Bnu"))).toBeNull();
    expect(parseConsent(readConsentCookie("altceva=1"))).toBeNull();
  });
});
