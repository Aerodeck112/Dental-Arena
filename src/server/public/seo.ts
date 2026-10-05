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
