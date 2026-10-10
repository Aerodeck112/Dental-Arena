/**
 * Front-desk DTOs (WP6: Azi, calendar, appointments, leads, recalls). Types only and client-safe:
 * client components import from here; nothing in this file imports `server-only` or the Prisma
 * runtime. Instants are ISO strings (UTC); local times are minutes after local midnight.
 */
import type {
  AppointmentSource,
  AppointmentStatus,
  Comfort,
  LeadActivityType,
  LeadSource,
  LeadStatus,
  RecallStatus,
  Role,
} from "@/generated/prisma/enums";

export type FlagDTO = { kind: "alerta" | "confort" | "copil" | "sedare" | "online"; label: string };

export type Option = { value: string; label: string };

/** One appointment as the calendar, the drawer and the Azi list draw it. */
export type CalendarAppointment = {
  id: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  /** Local date `YYYY-MM-DD`. */
  dateISO: string;
  startMinute: number;
  endMinute: number;
  startsAt: string;
  endsAt: string;
  locationId: string;
  locationName: string;
  doctorId: string;
  doctorName: string;
  cabinetId: string | null;
  cabinetName: string | null;
  patientId: string | null;
  leadId: string | null;
  /** Patient name, or the lead's name for a tentative online booking. */
  title: string;
  phone: string | null;
  fileNumber: number | null;
  serviceId: string | null;
  serviceName: string | null;
  reason: string | null;
  comfort: Comfort | null;
  comfortNote: string | null;
  wantsSedation: boolean;
  notes: string | null;
  /** Overlays (§3.4): alertă, confort, copil, sedare, online. */
  flags: FlagDTO[];
  confirmedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  updatedAt: string;
  /** Status targets this user may choose now (§6.4 plus role rules). */
  actions: AppointmentStatus[];
  /** The user may edit, move or change status (MEDIC: own only). */
  canManage: boolean;
};

export type CalendarView = "zi" | "saptamana";
export type CalendarColumnsMode = "medici" | "cabinete";

/** A column of the day view (a doctor or a cabinet), or a day of the week view. */
export type CalendarColumn = {
  id: string;
  kind: "doctor" | "cabinet" | "day";
  label: string;
  sublabel?: string;
  /** Local date of the column (the day view repeats the selected date). */
  dateISO: string;
  /** For a doctor column / a day column: the doctor. For a cabinet column: null. */
  doctorId: string | null;
  cabinetId: string | null;
  /** Location used when creating an appointment in this column (first shift's location, or the scope's first). */
  locationId: string;
  /** Working intervals (local minutes) with breaks removed; empty = not working. */
  open: [number, number][];
  /** Breaks inside the shifts, shaded with their label. */
  breaks: { start: number; end: number; label: string | null }[];
  /** Time off / closures intersecting the day. */
  timeOff: { start: number; end: number; label: string }[];
};

export type CalendarData = {
  view: CalendarView;
  columnsMode: CalendarColumnsMode;
  dateISO: string;
  /** Monday of the week (week view) or the date itself. */
  weekStartISO: string;
  title: string;
  todayISO: string;
  /** Minutes after midnight, now in clinic time (for the now-line). */
  nowMinute: number;
  /** Visible range of the grid, local minutes, multiples of 60. */
  dayStart: number;
  dayEnd: number;
  columns: CalendarColumn[];
  appointments: CalendarAppointment[];
  doctors: { id: string; name: string; shortName: string }[];
  selectedDoctorId: string | null;
  role: Role;
  userDoctorId: string | null;
  canCreate: boolean;
  scopeLabel: string;
};

/** Options for the appointment forms (quick-create, full form, edit, move). */
export type AppointmentFormOptions = {
  locations: { id: string; name: string; shortName: string }[];
  doctors: { id: string; name: string; locationIds: string[] }[];
  cabinets: { id: string; name: string; locationId: string }[];
  services: { id: string; name: string; categoryName: string; durationMinutes: number }[];
  /** MEDIC: their doctor id (the doctor field is fixed); otherwise null. */
  forcedDoctorId: string | null;
  canOverride: boolean;
  role: Role;
};

export type PatientPick = {
  id: string;
  fileNumber: number;
  name: string;
  phone: string | null;
  birthDate: string | null;
};

// ───────────────────────────── Azi ─────────────────────────────

export type ClinicSummary = {
  locationId: string;
  name: string;
  appointments: number;
  leadsNew: number;
  recallsDue: number;
  /** Bani collected today, or null when the user may not see money. */
  collectedToday: number | null;
};

export type LeadQueueItem = {
  id: string;
  name: string;
  phone: string | null;
  source: LeadSource;
  createdAt: string;
  serviceName: string | null;
  locationName: string | null;
  comfort: Comfort | null;
  preferredTime: string | null;
  /** A tentative online appointment, if any. */
  appointment: { id: string; startsAt: string; status: AppointmentStatus; doctorName: string } | null;
};

export type RecallQueueItem = {
  id: string;
  patientId: string;
  patientName: string;
  phone: string | null;
  reason: string;
  dueDate: string;
  status: RecallStatus;
  attempts: number;
};

export type BalanceQueueItem = { patientId: string; name: string; phone: string | null; balance: number };

export type KpiSummary = {
  monthLabel: string;
  appointmentsTotal: number;
  noShowRate: number | null;
  leadsNew: number;
  leadConversionRate: number | null;
  /** Bani; null without `dashboard.revenue`. */
  revenueCollected: number | null;
  revenueInvoiced: number | null;
  /** MEDIC: own production this month (bani), else null. */
  ownProduction: number | null;
};

export type DashboardData = {
  dateISO: string;
  title: string;
  summaries: ClinicSummary[];
  today: CalendarAppointment[];
  /** MEDIC: the id of their doctor (their rows come first). */
  ownDoctorId: string | null;
  leads: LeadQueueItem[] | null;
  recalls: RecallQueueItem[];
  balances: BalanceQueueItem[] | null;
  kpis: KpiSummary;
  nowISO: string;
};

// ───────────────────────────── Cereri ─────────────────────────────

export type LeadCardDTO = {
  id: string;
  status: LeadStatus;
  source: LeadSource;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  locationId: string | null;
  locationName: string | null;
  serviceName: string | null;
  preferredTime: string | null;
  comfort: Comfort | null;
  wantsSedation: boolean;
  forChild: boolean;
  childLabel: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  patientId: string | null;
  lostReason: string | null;
  lastActivityAt: string | null;
  appointment: { id: string; startsAt: string; status: AppointmentStatus; doctorName: string; locationName: string } | null;
};

export type LeadActivityDTO = {
  id: string;
  type: LeadActivityType;
  body: string | null;
  authorName: string | null;
  createdAt: string;
};

export type LeadDetailDTO = LeadCardDTO & {
  message: string | null;
  comfortNote: string | null;
  consentGdprAt: string | null;
  consentTextVersion: string | null;
  consentSms: boolean;
  sourcePath: string | null;
  contactedAt: string | null;
  convertedAt: string | null;
  patientName: string | null;
  patientFileNumber: number | null;
  activities: LeadActivityDTO[];
  appointments: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
    doctorName: string;
    locationName: string;
    tentative: boolean;
  }[];
  /** Suggested patient fields for conversion. */
  suggested: { firstName: string; lastName: string; phone: string | null; email: string | null };
};

export type LeadFilters = {
  status?: LeadStatus | null;
  source?: LeadSource | null;
  locationIds?: string[];
  assignedToId?: string | null;
  q?: string;
};

// ───────────────────────────── Rechemări ─────────────────────────────

export type RecallOutcome = "FARA_RASPUNS" | "REVINE" | "REFUZAT";

export type RecallRow = RecallQueueItem & {
  locationName: string | null;
  doctorName: string | null;
  lastAttemptAt: string | null;
  outcomeNote: string | null;
  bookedAppointmentId: string | null;
  /** Days until due (negative = overdue). */
  dueInDays: number;
};
