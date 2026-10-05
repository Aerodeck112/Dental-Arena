/**
 * Site-wide copy and facts (docs/architecture.md §11 WP3, design-system.md §6.3 and §12).
 * Pure data: safe in server and client components.
 *
 * The CRM is the source of truth for doctors, prices, hours and free slots. Addresses and phones
 * also live in `Location`, but the site chrome (header, footer, call menus) reads them from here so
 * it renders without the database; keep both in step (they match prisma/seed-data/locations.ts).
 */

export type ClinicSlug = "cristesti" | "ludus";

export type ClinicInfo = {
  slug: ClinicSlug;
  /** „Dental Arena Cristești” */
  name: string;
  /** „Cristești” */
  shortName: string;
  street: string;
  city: string;
  county: string;
  postalCode: string;
  /** Display form, „0265 326 316”. */
  phone: string;
  /** Where it is, in one phrase („lângă Târgu Mureș”), or null. */
  area: string | null;
  /** Google Maps search link (opens the app or the site; no cookies before a click). */
  mapsLink: string;
  /** Google Maps embed, loaded only after consent (MapConsent). */
  mapsEmbed: string;
  photo: { src: string; alt: string; width: number; height: number };
  /** A second photo for „Cum ne găsiți”, when there is one. */
  directionsPhoto?: { src: string; alt: string; width: number; height: number };
};

export const CLINICS: Record<ClinicSlug, ClinicInfo> = {
  cristesti: {
    slug: "cristesti",
    name: "Dental Arena Cristești",
    shortName: "Cristești",
    street: "str. Principală 536J/1",
    city: "Cristești",
    county: "Mureș",
    postalCode: "547185",
    phone: "0265 326 316",
    area: "lângă Târgu Mureș",
    mapsLink:
      "https://www.google.com/maps/search/?api=1&query=Dental%20Arena%2C%20str.%20Principal%C4%83%20536J%2F1%2C%20Criste%C8%99ti%2C%20Mure%C8%99",
    mapsEmbed:
      "https://maps.google.com/maps?q=str.%20Principal%C4%83%2C%20536J%2F1%20Criste%C8%99ti&t=m&z=16&output=embed&iwloc=near",
    photo: {
      src: "/images/clinica/cristesti-fatada.jpg",
      alt: "Fațada clinicii Dental Arena din Cristești, cu firma „Dental Arena, clinică stomatologică” deasupra vitrinei",
      width: 2000,
      height: 1334,
    },
  },
  ludus: {
    slug: "ludus",
    name: "Dental Arena Luduș",
    shortName: "Luduș",
    street: "str. Gheorghe Barițiu nr. 6",
    city: "Luduș",
    county: "Mureș",
    postalCode: "545202",
    phone: "0365 430 125",
    area: null,
    mapsLink:
      "https://www.google.com/maps/search/?api=1&query=Dental%20Arena%2C%20str.%20Gheorghe%20Bari%C8%9Biu%20nr.%206%2C%20Ludu%C8%99%2C%20Mure%C8%99",
    mapsEmbed:
      "https://maps.google.com/maps?q=str.%20Gheorghe%20Bari%C8%9Biu%2C%20nr.%206%2C%20Ludu%C8%99%2C%20Mure%C8%99&t=m&z=16&output=embed&iwloc=near",
    photo: {
      src: "/images/clinica/ludus-seara.jpg",
      alt: "Clinica Dental Arena din Luduș seara: casa albă cu coloana îmbrăcată în lemn și aleea luminată",
      width: 1440,
      height: 1800,
    },
    directionsPhoto: {
      src: "/images/clinica/ludus-zi.jpg",
      alt: "Clinica Dental Arena din Luduș ziua, văzută de la poarta din fier forjat",
      width: 1500,
      height: 2000,
    },
  },
};

/** Cristești first, then Luduș: the order of every two-clinic split (left and right of the axis). */
export const CLINIC_ORDER: readonly ClinicSlug[] = ["cristesti", "ludus"];

export function isClinicSlug(v: string): v is ClinicSlug {
  return v === "cristesti" || v === "ludus";
}

/** „str. Principală 536J/1, Cristești, Mureș” */
export function clinicAddress(c: Pick<ClinicInfo, "street" | "city" | "county">): string {
  return `${c.street}, ${c.city}, ${c.county}`;
}

export const SITE = {
  /** Used in titles and JSON-LD. */
  name: "Dental Arena",
  /** The clinic's own name for itself (footer copyright). */
  brandName: "Dental Arena Clinic",
  tagline: "Zâmbete sănătoase pentru o viață fericită.",
  email: "office@dentalarena.ro",
  facebookUrl: "https://www.facebook.com/www.dentalarena.ro",
  instagramUrl: "https://www.instagram.com/clinicadentalarena/",
  /** Production origin, used when APP_URL is not set (metadata, sitemap, JSON-LD). */
  fallbackUrl: "https://dentalarena.ro",
  /** <title> of the home page (absolute, no template). */
  homeTitle: "Dental Arena, clinică stomatologică în Cristești și Luduș",
  defaultDescription:
    "Clinică stomatologică de familie în Cristești, lângă Târgu Mureș, și în Luduș. Consultații, implanturi, ortodonție, stomatologie pentru copii și tratament sub inhalosedare.",
  /** Default share image: the reception hand-over (a real clinic photo). */
  ogImage: { src: "/images/clinica/receptie.jpg", width: 1430, height: 953, alt: "Recepția clinicii Dental Arena" },
} as const;

export type NavLink = { href: string; label: string };

/** Header navigation (design-system §6.3, decision §0.2: „Echipa”, „Clinici” → /contact#clinici). */
export const MAIN_NAV: readonly NavLink[] = [
  { href: "/servicii", label: "Servicii" },
  { href: "/echipa", label: "Echipa" },
  { href: "/preturi", label: "Prețuri" },
  { href: "/contact#clinici", label: "Clinici" },
  { href: "/despre-noi", label: "Despre noi" },
];

export const FOOTER_NAV: readonly NavLink[] = [
  { href: "/servicii", label: "Servicii" },
  { href: "/echipa", label: "Echipa" },
  { href: "/preturi", label: "Prețuri" },
  { href: "/contact#clinici", label: "Clinici" },
  { href: "/despre-noi", label: "Despre noi" },
  { href: "/contact", label: "Contact" },
  { href: "/programare", label: "Programare" },
];

export const LEGAL_NAV: readonly NavLink[] = [
  { href: "/termeni-si-conditii", label: "Termeni și condiții" },
  { href: "/politica-de-confidentialitate", label: "Confidențialitate" },
  { href: "/politica-cookies", label: "Politica cookies" },
];

/** The ANPC pictograms (legally required in the footer). */
export const ANPC_BADGES = [
  {
    href: "https://anpc.ro/ce-este-sal/",
    src: "/images/legal/anpc-sal.jpg",
    alt: "ANPC: soluționarea alternativă a litigiilor (SAL)",
  },
  {
    href: "https://ec.europa.eu/consumers/odr/main/index.cfm?event=main.home2.show&lng=RO",
    src: "/images/legal/anpc-sol.jpg",
    alt: "Soluționarea online a litigiilor (SOL), Comisia Europeană",
  },
] as const;

/** Booking URL with prefilled values (architecture §4.1: the wizard reads these query params). */
export function bookingHref(p: {
  serviciu?: string | null;
  clinica?: ClinicSlug | null;
  medic?: string | null;
  ora?: string | null;
  confort?: "fara-emotii" | "emotii" | "frica" | null;
} = {}): string {
  const q = new URLSearchParams();
  if (p.serviciu) q.set("serviciu", p.serviciu);
  if (p.clinica) q.set("clinica", p.clinica);
  if (p.medic) q.set("medic", p.medic);
  if (p.ora) q.set("ora", p.ora);
  if (p.confort) q.set("confort", p.confort);
  const s = q.toString();
  return s ? `/programare?${s}` : "/programare";
}
