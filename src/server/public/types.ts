/**
 * DTOs the public site passes from Server Components to client islands. Types only and
 * client-safe: no Prisma rows ever reach the browser (architecture §8.5).
 */

import type { ClinicSlug } from "@/content/site";

export type PublicPrice = {
  id: string;
  code: string | null;
  name: string;
  /** Formatted by formatLei: „2.200 lei”, „de la 200 lei”, „900 / 1.100 lei”, „150 lei / oră”. */
  price: string;
  /** True when the price is „Prețul îl aflați la telefon”. */
  onRequest: boolean;
};

export type PublicCategory = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  prices: PublicPrice[];
};

export type PublicDoctor = {
  id: string;
  slug: string;
  /** „Dr. Andrei Marcoci” */
  publicName: string;
  /** „Dr. Marcoci”, for „Programați-vă la Dr. Marcoci”. */
  shortName: string;
  roleLine: string;
  bio: string | null;
  photoPath: string | null;
  /** „VP” when there is no portrait. */
  monogram: string;
  acceptsOnlineBooking: boolean;
  /** The services the doctor is shown for on the site (DoctorCategory.showOnSite). */
  services: { slug: string; name: string }[];
};

export type PublicLocationHours = { weekday: number; openMinute: number; closeMinute: number };

export type PublicLocation = {
  id: string;
  slug: ClinicSlug;
  name: string;
  shortName: string;
  street: string;
  city: string;
  county: string;
  postalCode: string | null;
  phone: string;
  email: string | null;
  /** Hours appear only once the clinic has confirmed them (`publishHours`). Empty otherwise. */
  hours: PublicLocationHours[];
  publishHours: boolean;
};

export type ServiceIndexRow = {
  slug: string;
  name: string;
  summary: string;
  /** The representative price set in the CRM (one per category), or null. */
  representative: { name: string; price: string } | null;
};

export type ServicePageData = {
  category: { id: string; slug: string; name: string };
  prices: PublicPrice[];
  /** „Cine vă tratează”: doctors with showOnSite for this category. */
  doctors: PublicDoctor[];
  /** Booking reason passed to /programare?serviciu=. */
  bookingCode: string;
};

/** „Unde lucrează”: weekdays per clinic, only for clinics whose hours are published. */
export type DoctorWorkplace = { clinic: ClinicSlug; clinicName: string; weekdays: number[] };

export type AvailabilitySlot = {
  /** ISO instant. */
  startsAt: string;
  /** „10:30” */
  time: string;
  /** „mar. 7 oct.” */
  dayShort: string;
  /** „marți, 7 octombrie” */
  dayLong: string;
  /** /programare with the reason, clinic and time filled in. */
  href: string;
};

export type ClinicAvailability = {
  clinic: ClinicSlug;
  shortName: string;
  phone: string;
  slots: AvailabilitySlot[];
  /** „Toate orele din Cristești”. */
  allHref: string;
};
