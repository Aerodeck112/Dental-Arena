import "server-only";
import type { Metadata } from "next";
import { CLINICS, SITE } from "@/content/site";
import { env } from "@/lib/env";
import { telHref } from "@/lib/format";
import type { PublicLocation } from "./types";

/** Absolute origin of the public site (APP_URL), without a trailing slash. */
export function siteUrl(): string {
  return (env.APP_URL || SITE.fallbackUrl).replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageMeta = {
  /** Page title; the layout template adds „ | Dental Arena”. */
  title: string;
  description: string;
  /** Canonical path, e.g. "/implantologie". */
  path: string;
  /** Share image (a real clinic photo); defaults to the reception. */
  image?: { src: string; width: number; height: number; alt: string };
  /** Skip the „ | Dental Arena” template (home page). */
  absoluteTitle?: boolean;
};

/**
 * Metadata of one public page: unique title and description, canonical URL and Open Graph.
 * Child openGraph objects replace the parent's, so every page sets the whole object.
 */
export function pageMetadata({ title, description, path, image, absoluteTitle = false }: PageMeta): Metadata {
  const img = image ?? SITE.ogImage;
  // A title that already names the clinic does not get the „ | Dental Arena” suffix twice.
  if (title.includes(SITE.name)) absoluteTitle = true;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: absoluteTitle ? title : `${title} | ${SITE.name}`,
      description,
      url: path,
      siteName: SITE.name,
      locale: "ro_RO",
      type: "website",
      images: [{ url: img.src, width: img.width, height: img.height, alt: img.alt }],
    },
  };
}

/**
 * schema.org `Dentist` for one clinic (architecture §11 WP3). Opening hours only once the clinic
 * has published them; no geo pin until the coordinates are verified (seed note, §10.1).
 */
export function dentistJsonLd(loc: PublicLocation): Record<string, unknown> {
  const base = siteUrl();
  const clinic = CLINICS[loc.slug];
  const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dentist",
    "@id": `${base}/contact#${loc.slug}`,
    name: loc.name,
    url: `${base}/contact#${loc.slug}`,
    telephone: telHref(loc.phone).replace(/^tel:/, ""),
    email: loc.email ?? SITE.email,
    image: `${base}${clinic.photo.src}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: loc.street,
      addressLocality: loc.city,
      addressRegion: loc.county,
      ...(loc.postalCode ? { postalCode: loc.postalCode } : {}),
      addressCountry: "RO",
    },
    ...(clinic.area ? { areaServed: [{ "@type": "City", name: "Târgu Mureș" }, { "@type": "City", name: loc.city }] } : {}),
    hasMap: clinic.mapsLink,
    parentOrganization: { "@type": "MedicalOrganization", name: SITE.brandName, url: base },
    sameAs: [SITE.facebookUrl, SITE.instagramUrl],
  };
  if (loc.publishHours && loc.hours.length > 0) {
    data.openingHoursSpecification = loc.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY[h.weekday - 1]}`,
      opens: hhmm(h.openMinute),
      closes: hhmm(h.closeMinute),
    }));
  }
  return data;
}

/** schema.org `BreadcrumbList`: the path shown under the result in Google. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Acasă", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** The clinic as one organisation with its two locations, plus the website (home page). */
export function organizationJsonLd(locations: PublicLocation[]): Record<string, unknown>[] {
  const base = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": ["MedicalOrganization", "Dentist"],
      "@id": `${base}/#organizatie`,
      name: SITE.brandName,
      alternateName: SITE.name,
      url: `${base}/`,
      logo: `${base}/brand/logo-dental-arena.png`,
      image: `${base}${SITE.ogImage.src}`,
      email: SITE.email,
      telephone: locations[0] ? telHref(locations[0].phone).replace(/^tel:/, "") : undefined,
      medicalSpecialty: "Dentistry",
      areaServed: ["Cristești", "Luduș", "Târgu Mureș", "Județul Mureș"].map((name) => ({ "@type": "Place", name })),
      department: locations.map((l) => ({ "@id": `${base}/contact#${l.slug}` })),
      sameAs: [SITE.facebookUrl, SITE.instagramUrl],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${base}/#site`,
      name: SITE.name,
      url: `${base}/`,
      inLanguage: "ro-RO",
      publisher: { "@id": `${base}/#organizatie` },
    },
  ];
}

/** Parses „2.200 lei”, „de la 200 lei”, „900 / 1.100 lei” into numbers for an Offer. */
export function priceNumbers(price: string): { min: number; max: number } | null {
  const nums = [...price.matchAll(/\d+(?:\.\d{3})*(?:,\d+)?/g)].map((m) => Number(m[0].replace(/\./g, "").replace(",", ".")));
  if (nums.length === 0 || nums.some(Number.isNaN)) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** A service page: the treatment, who provides it and its price list as offers. */
export function serviceJsonLd(p: {
  name: string;
  description: string;
  path: string;
  prices: { name: string; price: string; onRequest: boolean }[];
}): Record<string, unknown> {
  const base = siteUrl();
  const offers = p.prices.flatMap((pr) => {
    if (pr.onRequest) return [];
    const n = priceNumbers(pr.price);
    if (!n) return [];
    const from = /de la/i.test(pr.price);
    return [
      {
        "@type": "Offer",
        name: pr.name,
        priceCurrency: "RON",
        ...(n.min === n.max && !from
          ? { price: n.min }
          : { priceSpecification: { "@type": "PriceSpecification", priceCurrency: "RON", minPrice: n.min, ...(n.max > n.min ? { maxPrice: n.max } : {}) } }),
      },
    ];
  });
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${base}${p.path}#serviciu`,
    name: p.name,
    serviceType: p.name,
    description: p.description,
    url: absoluteUrl(p.path),
    provider: { "@id": `${base}/#organizatie` },
    areaServed: ["Cristești", "Luduș", "Târgu Mureș"].map((name) => ({ "@type": "City", name })),
    ...(offers.length > 0 ? { hasOfferCatalog: { "@type": "OfferCatalog", name: `Prețuri: ${p.name}`, itemListElement: offers } } : {}),
  };
}

/** Questions and answers shown on the page (only the ones visible there). */
export function faqJsonLd(faqs: { question: string; answer: string }[]): Record<string, unknown> | null {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

/** A doctor's profile page. */
export function physicianJsonLd(d: { publicName: string; roleLine: string; slug: string; photoPath: string | null; bio?: string | null }): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${base}/echipa/${d.slug}#medic`,
    name: d.publicName,
    jobTitle: d.roleLine,
    ...(d.bio ? { description: d.bio } : {}),
    url: absoluteUrl(`/echipa/${d.slug}`),
    ...(d.photoPath ? { image: `${base}${d.photoPath}` } : {}),
    worksFor: { "@id": `${base}/#organizatie` },
    knowsAbout: "Stomatologie",
  };
}
