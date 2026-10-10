import "server-only";
import { cache } from "react";
import type { PriceUnit } from "@/generated/prisma/enums";
import { bookingHref, isClinicSlug, type ClinicSlug } from "@/content/site";
import { getServiceContent } from "@/content/services";
import { prisma } from "@/lib/db";
import { formatDateRo, formatLei } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { getNextFreeSlots } from "@/server/scheduling/availability";
import type {
  ClinicAvailability,
  DoctorWorkplace,
  PublicCategory,
  PublicDoctor,
  PublicLocation,
  PublicPrice,
  ServiceIndexRow,
  ServicePageData,
} from "./types";

/**
 * Read-only queries for the public site (architecture §4.1). Everything the site shows about
 * doctors, prices, clinics and free slots comes from the CRM through these functions.
 *
 * Catalog queries are allowed to throw: a page that fails while revalidating keeps serving its
 * last good version, which is better than caching an empty price list. Only availability falls
 * back silently (to the phone numbers), as the design asks.
 */

// ─────────────────────────────── Prices ───────────────────────────────

type PriceRow = {
  id: string;
  code: string | null;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  priceFrom: boolean;
  unit: PriceUnit;
};

const PRICE_SELECT = {
  id: true,
  code: true,
  name: true,
  priceMin: true,
  priceMax: true,
  priceFrom: true,
  unit: true,
} as const;

export function toPublicPrice(s: PriceRow): PublicPrice {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    price: formatLei(s.priceMin, { from: s.priceFrom, max: s.priceMax, unit: s.unit }),
    onRequest: s.priceMin === null,
  };
}

/** Visible price items, in catalog order. */
const VISIBLE_SERVICE = { active: true, publicVisible: true } as const;
const VISIBLE_CATEGORY = { active: true, publicVisible: true } as const;

/** Every public category with its prices (`/preturi`). */
export const getAllPublicCatalog = cache(async (): Promise<PublicCategory[]> => {
  const categories = await prisma.serviceCategory.findMany({
    where: VISIBLE_CATEGORY,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      services: {
        where: VISIBLE_SERVICE,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: PRICE_SELECT,
      },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    summary: c.summary,
    prices: c.services.map(toPublicPrice),
  }));
});

/** Prices by Service.code (home „Copiii”, the inhalosedare price in the comfort reply). */
export const getPricesByCodes = cache(async (codes: readonly string[]): Promise<Map<string, PublicPrice>> => {
  const rows = await prisma.service.findMany({
    where: { code: { in: [...codes] }, active: true },
    select: PRICE_SELECT,
  });
  return new Map(rows.filter((r) => r.code).map((r) => [r.code as string, toPublicPrice(r)]));
});

/** The „Ce tratăm” index: each category with one sentence and its representative price. */
export const getServiceIndex = cache(async (): Promise<ServiceIndexRow[]> => {
  const categories = await prisma.serviceCategory.findMany({
    where: VISIBLE_CATEGORY,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      summary: true,
      services: {
        where: { ...VISIBLE_SERVICE, isRepresentative: true },
        orderBy: [{ sortOrder: "asc" }],
        take: 1,
        select: PRICE_SELECT,
      },
    },
  });
  return categories
    .filter((c) => getServiceContent(c.slug))
    .map((c) => {
      const rep = c.services[0];
      const content = getServiceContent(c.slug);
      return {
        slug: c.slug,
        name: c.name,
        summary: c.summary ?? content?.summary ?? "",
        representative: rep ? { name: rep.name, price: toPublicPrice(rep).price } : null,
      };
    });
});

// ─────────────────────────────── Doctors ───────────────────────────────

const DOCTOR_SELECT = {
  id: true,
  slug: true,
  honorific: true,
  firstName: true,
  lastName: true,
  publicName: true,
  roleLine: true,
  bio: true,
  photoPath: true,
  monogram: true,
  acceptsOnlineBooking: true,
  sortOrder: true,
  categories: {
    where: { showOnSite: true, category: VISIBLE_CATEGORY },
    select: { category: { select: { slug: true, name: true, sortOrder: true } } },
  },
} as const;

type DoctorRow = {
  id: string;
  slug: string;
  honorific: string;
  firstName: string;
  lastName: string;
  publicName: string;
  roleLine: string;
  bio: string | null;
  photoPath: string | null;
  monogram: string | null;
  acceptsOnlineBooking: boolean;
  sortOrder: number;
  categories: { category: { slug: string; name: string; sortOrder: number } }[];
};

/** Initials of the first and last name: „Victoria-Ana Podar” → „VP”. */
export function monogramOf(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toLocaleUpperCase("ro-RO");
}

export function toPublicDoctor(d: DoctorRow): PublicDoctor {
  return {
    id: d.id,
    slug: d.slug,
    publicName: d.publicName,
    shortName: `${d.honorific} ${d.lastName}`.trim(),
    roleLine: d.roleLine,
    bio: d.bio?.trim() ? d.bio.trim() : null,
    photoPath: d.photoPath,
    monogram: d.monogram?.trim() || monogramOf(d.firstName, d.lastName),
    acceptsOnlineBooking: d.acceptsOnlineBooking,
    services: [...d.categories]
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
      .map((c) => ({ slug: c.category.slug, name: c.category.name })),
  };
}

const VISIBLE_DOCTOR = { active: true, publicVisible: true } as const;

/** The team, in the CRM's order. */
export const getPublicDoctors = cache(async (): Promise<PublicDoctor[]> => {
  const rows = await prisma.doctor.findMany({
    where: VISIBLE_DOCTOR,
    orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
    select: DOCTOR_SELECT,
  });
  return rows.map(toPublicDoctor);
});

export const getPublicDoctor = cache(async (slug: string): Promise<PublicDoctor | null> => {
  const row = await prisma.doctor.findFirst({ where: { slug, ...VISIBLE_DOCTOR }, select: DOCTOR_SELECT });
  return row ? toPublicDoctor(row) : null;
});

/**
 * „Unde lucrează”: the weekdays of the doctor's current shifts, per clinic, only for clinics whose
 * hours are published (the demo schedules stay off the site until the clinic confirms them).
 */
export async function getDoctorWorkplaces(doctorId: string, now: Date = new Date()): Promise<DoctorWorkplace[]> {
  const shifts = await prisma.workShift.findMany({
    where: {
      doctorId,
      location: { active: true, publishHours: true },
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      ],
    },
    select: { weekday: true, location: { select: { slug: true, shortName: true, sortOrder: true } } },
  });
  const byClinic = new Map<ClinicSlug, { name: string; order: number; days: Set<number> }>();
  for (const s of shifts) {
    if (!isClinicSlug(s.location.slug)) continue;
    const entry = byClinic.get(s.location.slug) ?? { name: s.location.shortName, order: s.location.sortOrder, days: new Set<number>() };
    entry.days.add(s.weekday);
    byClinic.set(s.location.slug, entry);
  }
  return [...byClinic.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([clinic, e]) => ({ clinic, clinicName: e.name, weekdays: [...e.days].sort((a, b) => a - b) }));
}

// ─────────────────────────────── Service pages ───────────────────────────────

/**
 * The booking reason for a service page: the content's preferred code if it can be booked online,
 * else the first online-bookable reason in the category, else the home reason (Consultație).
 */
async function resolveBookingCode(categoryId: string, preferred: string | null): Promise<string> {
  const bookable = await prisma.service.findMany({
    where: { active: true, bookableOnline: true, urgent: false, onlineLabel: { not: null } },
    orderBy: [{ sortOrder: "asc" }],
    select: { code: true, categoryId: true },
  });
  if (preferred && bookable.some((s) => s.code === preferred)) return preferred;
  const own = bookable.find((s) => s.categoryId === categoryId && s.code);
  if (own?.code) return own.code;
  const booking = await getSettings("booking");
  return booking.homeServiceCode;
}

/** Prices and „Cine vă tratează” for one service page; null when the category is hidden. */
export const getPublicCatalog = cache(async (slug: string): Promise<ServicePageData | null> => {
  const category = await prisma.serviceCategory.findFirst({
    where: { slug, ...VISIBLE_CATEGORY },
    select: {
      id: true,
      slug: true,
      name: true,
      services: { where: VISIBLE_SERVICE, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: PRICE_SELECT },
      doctors: {
        where: { showOnSite: true, doctor: VISIBLE_DOCTOR },
        select: { doctor: { select: DOCTOR_SELECT } },
      },
    },
  });
  if (!category) return null;
  const content = getServiceContent(slug);
  const doctors = category.doctors.map((d) => d.doctor).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    category: { id: category.id, slug: category.slug, name: category.name },
    prices: category.services.map(toPublicPrice),
    doctors: doctors.map(toPublicDoctor),
    bookingCode: await resolveBookingCode(category.id, content?.bookingCode ?? null),
  };
});

// ─────────────────────────────── Clinics ───────────────────────────────

export const getPublicLocations = cache(async (): Promise<PublicLocation[]> => {
  const rows = await prisma.location.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      street: true,
      city: true,
      county: true,
      postalCode: true,
      phone: true,
      email: true,
      publishHours: true,
      hours: { orderBy: [{ weekday: "asc" }, { openMinute: "asc" }], select: { weekday: true, openMinute: true, closeMinute: true } },
    },
  });
  return rows
    .filter((r): r is typeof r & { slug: ClinicSlug } => isClinicSlug(r.slug))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortName: r.shortName,
      street: r.street,
      city: r.city,
      county: r.county,
      postalCode: r.postalCode,
      phone: r.phone,
      email: r.email,
      publishHours: r.publishHours,
      hours: r.publishHours ? r.hours : [],
    }));
});

// ─────────────────────────────── Availability (home panel) ───────────────────────────────

/**
 * The first free consultation slots per clinic (design-system §6.4). Any error, a disabled online
 * booking or an empty result gives `slots: []`, and the panel shows the phone instead.
 */
export async function getHomeAvailability(count = 3, only?: ClinicSlug): Promise<ClinicAvailability[]> {
  const [locations, booking] = await Promise.all([
    getPublicLocations().catch(() => [] as PublicLocation[]),
    getSettings("booking").catch(() => null),
  ]);
  const serviceCode = booking?.homeServiceCode ?? "CON-CONSULT";
  const enabled = booking?.onlineEnabled ?? true;
  const chosen = only ? locations.filter((l) => l.slug === only) : locations;
  return Promise.all(
    chosen.map(async (loc) => {
      let slots: Awaited<ReturnType<typeof getNextFreeSlots>> = [];
      if (enabled) {
        try {
          slots = await getNextFreeSlots(loc.id, count, serviceCode);
        } catch {
          slots = [];
        }
      }
      return {
        clinic: loc.slug,
        shortName: loc.shortName,
        phone: loc.phone,
        allHref: bookingHref({ serviciu: serviceCode, clinica: loc.slug }),
        slots: slots.slice(0, count).map((s) => ({
          startsAt: s.startsAt,
          time: s.localTime,
          dayShort: formatDateRo(s.startsAt, "weekday"),
          dayLong: formatDateRo(s.startsAt, "long"),
          href: bookingHref({ serviciu: serviceCode, clinica: loc.slug, ora: s.startsAt }),
        })),
      };
    }),
  );
}

// ─────────────────────────────── Legal pages ───────────────────────────────

/** Values for the `{{tokens}}` of the legal drafts (Setări → Datele clinicii, GDPR, Programări). */
export async function getLegalValues() {
  const [clinic, gdpr, booking] = await Promise.all([getSettings("clinic"), getSettings("gdpr"), getSettings("booking")]);
  return {
    legalName: clinic.legalName,
    cui: clinic.cui,
    regCom: clinic.regCom,
    registeredAddress: clinic.registeredAddress,
    email: clinic.email,
    dpoEmail: clinic.dpoEmail,
    leadRetentionDays: String(gdpr.leadRetentionDays),
    messageBodyRetentionDays: String(gdpr.messageBodyRetentionDays),
    cancelCutoffHours: String(booking.cancelCutoffHours),
    consentTextVersion: gdpr.consentTextVersion,
  };
}
