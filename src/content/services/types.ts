/**
 * Shape of one public service page (`/[serviciu]`). Prose lives here; prices, durations and
 * „Cine vă tratează” come from the CRM catalog (getPublicCatalog).
 */

export const SERVICE_SLUGS = [
  "consultatie-profilaxie",
  "stomatologie-generala",
  "inhalosedare",
  "implantologie",
  "chirurgie-dento-alveolara",
  "protetica-dentara",
  "pedodontie",
  "ortodontie",
  "parodontologie",
  "estetica-dentara",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export type ServiceImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** What and where, under the photo (text-mic, discret). */
  caption?: string;
  /** Low-resolution sources are never shown wider than this (px). */
  maxDisplayWidth?: number;
  /** object-position for the 4:3 crop, e.g. "50% 40%". */
  focus?: string;
};

export type ServiceStep = { label: string; detail?: string };

export type ServiceFaq = { question: string; answer: string };

export type ServiceContent = {
  slug: ServiceSlug;
  /** H1, menus and breadcrumbs: the page name, used everywhere (design-system §12.6). */
  title: string;
  /** Unique <title> (the layout adds „ | Dental Arena”). */
  seoTitle: string;
  /** Unique meta description, 120–170 characters, no prices (prices change in the CRM). */
  description: string;
  /** The lead under the H1: one or two plain sentences. */
  lead: string;
  /** One plain sentence for the „Ce tratăm” index when the catalog has no summary. */
  summary: string;
  /** Body paragraphs, the clinic's own words in the formal voice. */
  body: string[];
  /** „Cum decurge”: only where the clinic's copy describes a real sequence (design-system §6.5). */
  steps?: ServiceStep[];
  /** Under the steps, e.g. the usual duration. */
  stepsNote?: string;
  image?: ServiceImage;
  /** A second, smaller photo beside the prose. */
  secondaryImage?: ServiceImage;
  /** Shown under the price table. */
  priceNote: string;
  /** „Întrebări”: clinic-approved answers only. Empty until the clinic approves them. */
  faqs: ServiceFaq[];
  /** Heading of the closing booking band. */
  ctaTitle: string;
  /** Preferred booking reason (Service.code) for „Programați o consultație”. */
  bookingCode: string;
  /** Pass the comfort answer along (inhalosedare). */
  bookingComfort?: "frica";
  /** Show the „Vă e teamă?” comfort note (every page except Inhalosedare itself). */
  comfortNote: boolean;
  related: ServiceSlug[];
};
