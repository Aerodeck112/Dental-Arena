/**
 * Scheduling types (docs/architecture.md §6, §7.3). Types only and client-safe: client
 * components may import from here; nothing in this file imports `server-only` or Prisma runtime.
 */

/** One bookable start time. `startsAt`/`endsAt` are ISO instants (UTC); `localTime` is "HH:MM" in Europe/Bucharest. */
export type Slot = {
  startsAt: string;
  endsAt: string;
  localTime: string;
  period: "dimineata" | "dupa-amiaza";
  doctorIds: string[];
};

/** The slots of one local calendar day. Days without slots are kept with `slots: []`. */
export type DaySlots = { dateISO: string; slots: Slot[] };

export type SlotQuery = {
  locationId: string;
  serviceId: string;
  /** null or undefined = „Oricare medic”. */
  doctorId?: string | null;
  /** First local date, `YYYY-MM-DD`. */
  fromDateISO: string;
  /** Number of days; capped by `booking.maxDaysPerRequest` (at most 14). */
  days: number;
  channel: "online" | "crm";
  now?: Date;
};

export type ConflictKind =
  | "DOCTOR_OVERLAP" // block – same doctor, overlapping blocking appointment (any location)
  | "CABINET_OVERLAP" // block – same cabinet, overlapping blocking appointment
  | "TIME_OFF" // block – doctor on leave / location closed
  | "OUTSIDE_SHIFT" // warn – outside the doctor's shift at this location
  | "ON_BREAK" // warn – overlaps a shift break
  | "PATIENT_OVERLAP" // warn – same patient has another blocking appointment overlapping
  | "SEDATION_UNIT_BUSY" // warn – concurrent wantsSedation appointments >= Location.sedationUnits
  | "IN_PAST"; // warn – start before now (back-office entry of a past visit)

export type ConflictSeverity = "block" | "warn";

export type Conflict = {
  kind: ConflictKind;
  severity: ConflictSeverity;
  message: string;
  appointmentId?: string;
};

/** An appointment about to be created or changed. `appointmentId` = the one being edited (excluded from checks). */
export type AppointmentCandidate = {
  appointmentId?: string;
  locationId: string;
  doctorId: string;
  cabinetId?: string | null;
  patientId?: string | null;
  startsAt: Date;
  endsAt: Date;
  wantsSedation?: boolean;
};

// ───────────────────────────── Booking wizard DTOs (client-safe) ─────────────────────────────

/** A reason offered in wizard step 1 (a service with `bookableOnline` and an `onlineLabel`). */
export type BookingReason = {
  serviceId: string;
  code: string | null;
  label: string;
  hint: string | null;
  urgent: boolean;
  durationMinutes: number;
};

export type BookingClinic = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  address: string;
  /** „lângă Târgu Mureș” for Cristești; null otherwise. */
  addressNote: string | null;
  phone: string;
  mapsUrl: string | null;
  /** Next free slot for the default service, if any (shown on the clinic panel). */
  nextSlot: { startsAt: string; localTime: string; dateISO: string } | null;
};

export type BookingDoctor = {
  id: string;
  slug: string;
  publicName: string;
  /** „/images/echipa/…”; null = monogram plate. */
  photoPath: string | null;
  monogram: string | null;
  /** Locations (ids) where the doctor has online-bookable shifts. */
  locationIds: string[];
  /** Service categories (ids) the doctor does; empty = all. */
  categoryIds: string[];
};

/** Everything the wizard needs to render step 1 and the doctor filter. */
export type BookingOptions = {
  onlineEnabled: boolean;
  reasons: (BookingReason & { categoryId: string })[];
  clinics: BookingClinic[];
  doctors: BookingDoctor[];
  /** Service code used for „Nu știu sigur”. */
  unsureServiceId: string | null;
  maxDays: number;
  horizonDays: number;
  gdprTextVersion: string;
};
