import type {
  Comfort,
  ConsentMethod,
  ConsentType,
  DataRequestStatus,
  DataRequestType,
  DocumentKind,
  LeadSource,
  PlanItemStatus,
  PlanStatus,
  Role,
  Sex,
  ToothConditionType,
  AppointmentStatus,
} from "@/generated/prisma/enums";

/**
 * Patient DTOs (docs/architecture.md §7.3, WP7). Types only: safe to import from client
 * components. No DTO ever carries `cnpEncrypted` or `cnpHash` (§8.5).
 */

/** A patient as shown in lists, pickers and duplicate warnings. */
export type PatientSummary = {
  id: string;
  fileNumber: number;
  name: string;
  phone: string | null;
  email: string | null;
  /** Local date `YYYY-MM-DD`, or null. */
  birthDate: string | null;
  anonymized: boolean;
};

/** Input of `createPatient` (§7.3). Values are already validated (E.164 phone, lowercased e-mail). */
export type PatientCreateInput = {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null;
  sex?: Sex | null;
  cnp?: string | null;
  guardianId?: string | null;
  preferredLocationId?: string | null;
  primaryDoctorId?: string | null;
  comfortDefault?: Comfort | null;
  smsOptIn?: boolean;
  emailOptIn?: boolean;
  acquisitionSource?: LeadSource | null;
};

/** Personal-data edit (`/date`). Same fields as create, plus address, notes and sedation preference. */
export type PatientUpdateInput = PatientCreateInput & {
  street?: string | null;
  city?: string | null;
  county?: string | null;
  prefersSedation?: boolean;
  notes?: string | null;
  /** Leave the stored CNP untouched when false (the form never round-trips the clear CNP). */
  cnpChanged?: boolean;
};

/** Why a candidate counts as a duplicate. */
export type DuplicateReason = "telefon" | "cnp" | "nume-data-nasterii" | "email";

export type DuplicateMatch = PatientSummary & { reasons: DuplicateReason[] };

/** Alert flags shown on the patient header and in the calendar (§5.2, design system §3.4). */
export type PatientFlagKind = "alerta" | "confort" | "copil" | "sedare";

/** One row of the patient list. */
export type PatientListRow = PatientSummary & {
  age: number | null;
  locationName: string | null;
  tags: { id: string; name: string; color: string | null }[];
  lastVisit: string | null;
  nextVisit: string | null;
};

export type PatientListResult = {
  rows: PatientListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type TagDTO = { id: string; name: string; color: string | null };

/** The header and „Prezentare” data (every role). */
export type PatientHeaderDTO = {
  id: string;
  fileNumber: number;
  firstName: string;
  lastName: string;
  name: string;
  age: number | null;
  birthDate: string | null;
  sex: Sex | null;
  phone: string | null;
  email: string | null;
  preferredLocation: { id: string; name: string } | null;
  primaryDoctor: { id: string; name: string } | null;
  comfortDefault: Comfort | null;
  prefersSedation: boolean;
  /** The patient's own words about comfort, from the most recent appointment that has them. */
  comfortNote: string | null;
  smsOptIn: boolean;
  emailOptIn: boolean;
  anonymized: boolean;
  active: boolean;
  hasCnp: boolean;
  cnpLast2: string | null;
  guardian: { id: string; name: string } | null;
  tags: TagDTO[];
};

/** Personal data (`/date`). */
export type PatientPersonalDTO = PatientHeaderDTO & {
  street: string | null;
  city: string | null;
  county: string | null;
  notes: string | null;
  acquisitionSource: LeadSource | null;
  dependents: { id: string; name: string; age: number | null }[];
  createdAt: string;
};

export type MedicalHistoryDTO = {
  allergies: string | null;
  medications: string | null;
  anticoagulants: boolean;
  cardiacDisease: boolean;
  hypertension: boolean;
  diabetes: boolean;
  asthma: boolean;
  epilepsy: boolean;
  hepatitis: boolean;
  hiv: boolean;
  bleedingDisorder: boolean;
  bisphosphonates: boolean;
  pregnancy: boolean;
  smoker: boolean;
  otherConditions: string | null;
  lastReviewedAt: string | null;
  lastReviewedBy: string | null;
};

export type ConsentDTO = {
  id: string;
  type: ConsentType;
  granted: boolean;
  method: ConsentMethod;
  textVersion: string;
  grantedAt: string;
  revokedAt: string | null;
  recordedBy: string | null;
  notes: string | null;
  document: { id: string; title: string } | null;
  planTitle: string | null;
};

export type ToothConditionDTO = {
  id: string;
  tooth: number;
  surfaces: string | null;
  condition: ToothConditionType;
  notes: string | null;
  recordedAt: string;
  recordedBy: string | null;
  resolvedAt: string | null;
};

export type PlanItemDTO = {
  id: string;
  serviceId: string | null;
  serviceCode: string | null;
  tooth: number | null;
  surfaces: string | null;
  description: string;
  phase: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  status: PlanItemStatus;
  performedAt: string | null;
  appointmentId: string | null;
  sortOrder: number;
};

export type PlanTotalsDTO = {
  subtotal: number;
  lineDiscounts: number;
  planDiscount: number;
  total: number;
  /** Σ total of EFECTUAT lines (after line discounts). */
  done: number;
  /** Σ total of lines that are not ANULAT. */
  active: number;
  itemCount: number;
  doneCount: number;
};

export type PlanSummaryDTO = {
  id: string;
  title: string;
  status: PlanStatus;
  doctor: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  presentedAt: string | null;
  acceptedAt: string | null;
  totals: PlanTotalsDTO;
  isImplant: boolean;
};

export type PlanDetailDTO = PlanSummaryDTO & {
  notes: string | null;
  discount: number;
  items: PlanItemDTO[];
};

export type DocumentDTO = {
  id: string;
  kind: DocumentKind;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  tooth: number | null;
  takenAt: string | null;
  uploadedBy: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type NoteDTO = {
  id: string;
  body: string;
  clinical: boolean;
  pinned: boolean;
  author: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  appointmentId: string | null;
};

export type PatientAppointmentDTO = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  locationName: string;
  doctorName: string;
  serviceName: string | null;
  reason: string | null;
  cancelReason: string | null;
};

export type AuditEntryDTO = {
  id: string;
  at: string;
  action: string;
  actorName: string | null;
  actorRole: Role | null;
  entityType: string;
};

export type DataRequestDTO = {
  id: string;
  patient: { id: string; name: string; fileNumber: number } | null;
  type: DataRequestType;
  status: DataRequestStatus;
  requesterName: string;
  contact: string | null;
  details: string | null;
  receivedAt: string;
  dueAt: string;
  completedAt: string | null;
  handledBy: string | null;
  outcome: string | null;
  overdue: boolean;
  daysLeft: number;
};
