import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, physicianJsonLd, priceNumbers, serviceJsonLd } from "../seo";

describe("pageMetadata", () => {
  it("adds the clinic name through the layout template", () => {
    expect(pageMetadata({ title: "Implant dentar", description: "d", path: "/implantologie" }).title).toBe("Implant dentar");
  });

  it("does not repeat the clinic name when the title already has it", () => {
    const m = pageMetadata({ title: "Contact Dental Arena", description: "d", path: "/contact" });
    expect(m.title).toEqual({ absolute: "Contact Dental Arena" });
  });

  it("sets the canonical path", () => {
    expect(pageMetadata({ title: "T", description: "d", path: "/preturi" }).alternates?.canonical).toBe("/preturi");
  });
});

describe("priceNumbers", () => {
  it.each([
    ["2.200 lei", { min: 2200, max: 2200 }],
    ["2200 lei", { min: 2200, max: 2200 }],
    ["de la 200 lei", { min: 200, max: 200 }],
    ["550 – 700 lei", { min: 550, max: 700 }],
    ["1.234,50 lei", { min: 1234.5, max: 1234.5 }],
  ])("%s", (price, expected) => {
    expect(priceNumbers(price)).toEqual(expected);
  });

  it("returns null without a number", () => {
    expect(priceNumbers("la cerere")).toBeNull();
  });
});

describe("structured data", () => {
  it("starts every breadcrumb at the home page", () => {
    const ld = breadcrumbJsonLd([{ name: "Servicii", path: "/servicii" }]);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Acasă", item: "http://localhost:3000/" },
      { "@type": "ListItem", position: 2, name: "Servicii", item: "http://localhost:3000/servicii" },
    ]);
  });

  it("lists fixed prices, ranges and „de la” prices as offers, and skips prices on request", () => {
    const ld = serviceJsonLd({
      name: "Implantologie",
      description: "d",
      path: "/implantologie",
      prices: [
        { name: "Implant", price: "2.200 lei", onRequest: false },
        { name: "Bont", price: "550 – 700 lei", onRequest: false },
        { name: "Sinus lift", price: "de la 1.500 lei", onRequest: false },
        { name: "Ghid chirurgical", price: "La cerere", onRequest: true },
      ],
    });
    const offers = (ld.hasOfferCatalog as { itemListElement: Record<string, unknown>[] }).itemListElement;
    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({ name: "Implant", price: 2200, priceCurrency: "RON" });
    expect(offers[1].priceSpecification).toMatchObject({ minPrice: 550, maxPrice: 700 });
    expect(offers[2].priceSpecification).toEqual({ "@type": "PriceSpecification", priceCurrency: "RON", minPrice: 1500 });
  });

  it("leaves the offer catalog out when no price is published", () => {
    expect(serviceJsonLd({ name: "S", description: "d", path: "/s", prices: [] })).not.toHaveProperty("hasOfferCatalog");
  });

  it("builds a FAQ page only when there are questions", () => {
    expect(faqJsonLd([])).toBeNull();
    const ld = faqJsonLd([{ question: "Doare?", answer: "Nu." }]);
    expect(ld?.mainEntity).toEqual([{ "@type": "Question", name: "Doare?", acceptedAnswer: { "@type": "Answer", text: "Nu." } }]);
  });

  it("links a doctor to the clinic and leaves out a missing photo", () => {
    const ld = physicianJsonLd({ publicName: "Dr. Test", roleLine: "Medic dentist", slug: "test", photoPath: null });
    expect(ld.worksFor).toEqual({ "@id": "http://localhost:3000/#organizatie" });
    expect(ld).not.toHaveProperty("image");
  });
});
