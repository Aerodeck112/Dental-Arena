import "server-only";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { utcToLocal } from "@/lib/time";
import { getNextFreeSlots } from "./availability";
import type { BookingClinic, BookingDoctor, BookingOptions, BookingReason } from "./types";

/**
 * Data for the online booking wizard (`/programare`, docs/architecture.md §6.5, design system
 * §6.7): the reasons of step 1 (services with `bookableOnline` and an `onlineLabel`), the two
 * clinics with their next free slot, and the doctors who take online bookings. DTOs only.
 */

/** „str. Principală 536J/1, Cristești, Mureș” as a Google Maps search link (opens the app on phones). */
export function mapsSearchUrl(l: { street: string; city: string; county: string }): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.street, l.city, l.county].filter(Boolean).join(", "))}`;
}

/** The location line used on the clinic panels: Cristești sits „lângă Târgu Mureș” (content.json). */
function addressNoteOf(slug: string): string | null {
  return slug === "cristesti" ? "lângă Târgu Mureș" : null;
}

export async function getBookingOptions(): Promise<BookingOptions> {
  const [booking, gdpr] = await Promise.all([getSettings("booking"), getSettings("gdpr")]);

  const [services, locations, doctors] = await Promise.all([
    prisma.service.findMany({
      where: { active: true, bookableOnline: true, onlineLabel: { not: null } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, categoryId: true, onlineLabel: true, onlineHint: true, urgent: true, durationMinutes: true },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, shortName: true, street: true, city: true, county: true, phone: true },
    }),
    prisma.doctor.findMany({
      where: { active: true, acceptsOnlineBooking: true },
      orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        slug: true,
        publicName: true,
        photoPath: true,
        monogram: true,
        categories: { select: { categoryId: true } },
        shifts: { where: { onlineBooking: true }, select: { locationId: true } },
      },
    }),
  ]);

  const reasons: (BookingReason & { categoryId: string })[] = services.map((s) => ({
    serviceId: s.id,
    code: s.code,
    categoryId: s.categoryId,
    label: s.onlineLabel ?? "",
    hint: s.onlineHint,
    urgent: s.urgent,
    durationMinutes: s.durationMinutes,
  }));
  // Design system §6.7 lists „Am o durere acum” right after the first reason.
  const urgentIndex = reasons.findIndex((r) => r.urgent);
  if (urgentIndex > 1) reasons.splice(1, 0, ...reasons.splice(urgentIndex, 1));

  const unsure = services.find((s) => s.code === booking.unsureServiceCode) ?? null;

  const nextSlots = booking.onlineEnabled
    ? await Promise.all(locations.map((l) => getNextFreeSlots(l.id, 1)))
    : locations.map(() => []);

  const clinics: BookingClinic[] = locations.map((l, i) => {
    const next = nextSlots[i]?.[0] ?? null;
    return {
      id: l.id,
      slug: l.slug,
      name: l.name,
      shortName: l.shortName,
      address: l.street,
      addressNote: addressNoteOf(l.slug),
      phone: l.phone,
      mapsUrl: mapsSearchUrl(l),
      nextSlot: next
        ? { startsAt: next.startsAt, localTime: next.localTime, dateISO: utcToLocal(new Date(next.startsAt)).dateISO }
        : null,
    };
  });

  const bookingDoctors: BookingDoctor[] = doctors.map((d) => ({
    id: d.id,
    slug: d.slug,
    publicName: d.publicName,
    photoPath: d.photoPath,
    monogram: d.monogram,
    locationIds: [...new Set(d.shifts.map((s) => s.locationId))],
    categoryIds: d.categories.map((c) => c.categoryId),
  }));

  return {
    onlineEnabled: booking.onlineEnabled,
    reasons,
    clinics,
    doctors: bookingDoctors,
    unsureServiceId: unsure?.id ?? null,
    maxDays: Math.min(14, booking.maxDaysPerRequest),
    horizonDays: booking.horizonDays,
    gdprTextVersion: gdpr.consentTextVersion,
  };
}
