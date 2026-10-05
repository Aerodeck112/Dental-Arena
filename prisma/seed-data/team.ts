import type { Role, TimeOffKind } from "../../src/generated/prisma/enums";

/**
 * The team (docs/architecture.md §10.2). Display names follow design system §12.5 (first name,
 * then surname); role lines are verbatim from research/content.json with the diacritics fixed.
 * There are no bios on the current site, so `bio` stays empty until the clinic writes them.
 */

export type SeedDoctor = {
  slug: string;
  firstName: string;
  lastName: string;
  publicName: string;
  roleLine: string;
  photoPath: string | null;
  monogram: string | null;
  sortOrder: number;
  /** Category slugs; `showOnSite` = listed in „Cine vă tratează” (bold in §10.2). */
  categories: { slug: string; showOnSite: boolean }[];
  /** Login of the doctor's MEDIC account (placeholder address for dev). */
  email: string;
};

const cat = (slug: string, showOnSite = false) => ({ slug, showOnSite });

export const DOCTORS: readonly SeedDoctor[] = [
  {
    slug: "andrei-marcoci",
    firstName: "Andrei",
    lastName: "Marcoci",
    publicName: "Dr. Andrei Marcoci",
    roleLine: "Medic dentist, stomatologie generală",
    photoPath: "/images/echipa/andrei-marcoci.jpg",
    monogram: null,
    sortOrder: 1,
    categories: [
      cat("stomatologie-generala", true),
      cat("consultatie-profilaxie"),
      cat("pedodontie"),
      cat("parodontologie"),
      cat("estetica-dentara"),
      cat("protetica-dentara"),
    ],
    email: "andrei.marcoci@dentalarena.ro",
  },
  {
    slug: "mihail-dan-masca",
    firstName: "Mihail Dan",
    lastName: "Mașca",
    publicName: "Dr. Mihail Dan Mașca",
    roleLine: "Medic dentist, stomatologie generală, competență în implantologie",
    photoPath: "/images/echipa/mihail-dan-masca.png",
    monogram: null,
    sortOrder: 2,
    categories: [
      cat("implantologie", true),
      cat("stomatologie-generala", true),
      cat("consultatie-profilaxie"),
      cat("protetica-dentara"),
      cat("chirurgie-dento-alveolara"),
    ],
    email: "mihail.masca@dentalarena.ro",
  },
  {
    slug: "paul-bologa",
    firstName: "Paul",
    lastName: "Bologa",
    publicName: "Dr. Paul Bologa",
    roleLine: "Medic dentist, stomatologie generală",
    photoPath: "/images/echipa/paul-bologa.jpg",
    monogram: null,
    sortOrder: 3,
    categories: [
      cat("stomatologie-generala", true),
      cat("consultatie-profilaxie"),
      cat("pedodontie"),
      cat("parodontologie"),
      cat("estetica-dentara"),
      cat("protetica-dentara"),
    ],
    email: "paul.bologa@dentalarena.ro",
  },
  {
    slug: "victoria-ana-podar",
    firstName: "Victoria-Ana",
    lastName: "Podar",
    publicName: "Dr. Victoria-Ana Podar",
    roleLine: "Medic dentist specializat în ortodonție și ortopedie dento-facială",
    photoPath: null,
    monogram: "VP",
    sortOrder: 4,
    categories: [cat("ortodontie", true)],
    email: "victoria.podar@dentalarena.ro",
  },
  {
    slug: "ana-maria-fertea",
    firstName: "Ana-Maria",
    lastName: "Fertea",
    publicName: "Dr. Ana-Maria Fertea",
    roleLine: "Medic dentist, medic specialist în chirurgie dento-alveolară",
    photoPath: "/images/echipa/ana-maria-fertea.jpg",
    monogram: null,
    sortOrder: 5,
    categories: [cat("chirurgie-dento-alveolara", true), cat("consultatie-profilaxie")],
    email: "anamaria.fertea@dentalarena.ro",
  },
];

export type SeedStaffUser = {
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  homeLocation: "cristesti" | "ludus" | null;
};

/** Non-doctor accounts. An assistant gets a RECEPTIE account (§0.2). */
export const STAFF_USERS: readonly SeedStaffUser[] = [
  { email: "admin@dentalarena.ro", role: "ADMIN", firstName: "Administrator", lastName: "Clinică", homeLocation: null },
  {
    email: "receptie.cristesti@dentalarena.ro",
    role: "RECEPTIE",
    firstName: "Recepție",
    lastName: "Cristești",
    homeLocation: "cristesti",
  },
  { email: "receptie.ludus@dentalarena.ro", role: "RECEPTIE", firstName: "Recepție", lastName: "Luduș", homeLocation: "ludus" },
];

export const DEFAULT_SEED_PASSWORD = "parola-demo-2026";

export type SeedShift = {
  doctor: string;
  location: "cristesti" | "ludus";
  weekdays: number[];
  start: string;
  end: string;
  cabinet: string;
  breaks: { start: string; end: string; label: string }[];
};

const LUNCH = "Pauză de masă";

/** „Program demonstrativ” (§10.2): demo shifts until the clinic supplies the real ones. */
export const DEMO_SHIFTS: readonly SeedShift[] = [
  { doctor: "andrei-marcoci", location: "cristesti", weekdays: [1, 3, 5], start: "09:00", end: "15:00", cabinet: "Cabinet 1", breaks: [{ start: "12:00", end: "12:30", label: LUNCH }] },
  { doctor: "andrei-marcoci", location: "ludus", weekdays: [2, 4], start: "12:00", end: "19:00", cabinet: "Cabinet 1", breaks: [{ start: "15:30", end: "16:00", label: LUNCH }] },
  { doctor: "mihail-dan-masca", location: "cristesti", weekdays: [2, 4], start: "09:00", end: "17:00", cabinet: "Cabinet 2", breaks: [{ start: "13:00", end: "13:30", label: LUNCH }] },
  { doctor: "mihail-dan-masca", location: "ludus", weekdays: [1, 3], start: "12:00", end: "19:00", cabinet: "Cabinet 2", breaks: [{ start: "15:30", end: "16:00", label: LUNCH }] },
  { doctor: "paul-bologa", location: "cristesti", weekdays: [2, 4], start: "12:00", end: "19:00", cabinet: "Cabinet 1", breaks: [] },
  { doctor: "paul-bologa", location: "ludus", weekdays: [1, 3, 5], start: "09:00", end: "15:00", cabinet: "Cabinet 1", breaks: [] },
  { doctor: "victoria-ana-podar", location: "cristesti", weekdays: [3], start: "10:00", end: "18:00", cabinet: "Cabinet 3", breaks: [] },
  { doctor: "victoria-ana-podar", location: "ludus", weekdays: [5], start: "10:00", end: "16:00", cabinet: "Cabinet 2", breaks: [] },
  { doctor: "ana-maria-fertea", location: "cristesti", weekdays: [1, 4], start: "12:00", end: "19:00", cabinet: "Cabinet 3", breaks: [] },
  { doctor: "ana-maria-fertea", location: "ludus", weekdays: [2], start: "09:00", end: "14:00", cabinet: "Cabinet 2", breaks: [] },
];

export type SeedTimeOff = {
  doctor: string | null;
  location: "cristesti" | "ludus" | null;
  kind: TimeOffKind;
  /** Days from the seed day (local dates); `days` whole days long. */
  fromDayOffset?: number;
  /** Or a fixed month and day of the next occurrence (1 December). */
  nextMonthDay?: { month: number; day: number };
  days: number;
  reason: string;
};

export const DEMO_TIME_OFF: readonly SeedTimeOff[] = [
  { doctor: "ana-maria-fertea", location: null, kind: "CONCEDIU", fromDayOffset: 10, days: 3, reason: "Concediu de odihnă" },
  { doctor: null, location: "cristesti", kind: "SARBATOARE", nextMonthDay: { month: 12, day: 1 }, days: 1, reason: "Ziua Națională" },
  { doctor: null, location: "ludus", kind: "SARBATOARE", nextMonthDay: { month: 12, day: 1 }, days: 1, reason: "Ziua Națională" },
];
