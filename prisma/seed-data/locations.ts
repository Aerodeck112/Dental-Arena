/**
 * The two clinics (docs/architecture.md §10.1). Addresses and phones are verbatim from
 * research/content.json → general.clinic.locations; map URLs are the live embeds. Coordinates
 * are approximate street-level values (general.notes item 4): verify before using them as pins.
 */

export type SeedLocation = {
  slug: "cristesti" | "ludus";
  name: string;
  shortName: string;
  street: string;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
  email: string;
  mapsUrl: string;
  latitude: number;
  longitude: number;
  sedationUnits: number;
  sortOrder: number;
  /** Demo cabinets (chairs/rooms); the clinic confirms the real ones. */
  cabinets: string[];
};

export const LOCATIONS: readonly SeedLocation[] = [
  {
    slug: "cristesti",
    name: "Dental Arena Cristești",
    shortName: "Cristești",
    street: "str. Principală 536J/1",
    city: "Cristești",
    county: "Mureș",
    postalCode: "547185",
    phone: "0265 326 316",
    email: "office@dentalarena.ro",
    mapsUrl:
      "https://maps.google.com/maps?q=str.%20Principal%C4%83%2C%20536J%2F1%20Criste%C8%99ti&t=m&z=16&output=embed&iwloc=near",
    latitude: 46.5092,
    longitude: 24.5058,
    sedationUnits: 1,
    sortOrder: 1,
    cabinets: ["Cabinet 1", "Cabinet 2", "Cabinet 3"],
  },
  {
    slug: "ludus",
    name: "Dental Arena Luduș",
    shortName: "Luduș",
    street: "str. Gheorghe Barițiu nr. 6",
    city: "Luduș",
    county: "Mureș",
    postalCode: "545202",
    phone: "0365 430 125",
    email: "office@dentalarena.ro",
    mapsUrl:
      "https://maps.google.com/maps?q=str.%20Gheorghe%20Bari%C8%9Biu%2C%20nr.%206%2C%20Ludu%C8%99%2C%20Mure%C8%99&t=m&z=16&output=embed&iwloc=near",
    latitude: 46.4819,
    longitude: 24.0943,
    sedationUnits: 1,
    sortOrder: 2,
    cabinets: ["Cabinet 1", "Cabinet 2"],
  },
];

/**
 * Demo opening hours: Monday–Friday 09:00–19:00 at both clinics. `publishHours` stays false, so
 * the site never shows them until the clinic confirms its real hours (§0.2).
 */
export const DEMO_HOURS: readonly { weekday: number; openMinute: number; closeMinute: number }[] = [1, 2, 3, 4, 5].map(
  (weekday) => ({ weekday, openMinute: 9 * 60, closeMinute: 19 * 60 }),
);
