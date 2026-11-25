/**
 * Messaging types (docs/architecture.md §9). Types only, client-safe: no `server-only`, no runtime
 * imports, so client components (the template editor, the send dialog) may import them.
 */
import type { MessageChannel, MessageKind, MessageStatus } from "@/generated/prisma/enums";

export type { MessageChannel, MessageKind, MessageStatus };

/** Variables available in templates (§9.2). `motiv` is for clinic notifications only. */
export const TEMPLATE_VARIABLES = [
  "prenume",
  "nume",
  "data",
  "ora",
  "clinica",
  "clinicaScurt",
  "adresa",
  "telefonClinica",
  "medic",
  "link",
  "motiv",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateVars = Partial<Record<TemplateVariable, string>>;

/** Every template key the code knows (§9.2). The DB may override any of them. */
export const TEMPLATE_KEYS = [
  "booking.received.email",
  "booking.confirmed.sms",
  "booking.confirmed.email",
  "reminder.sms",
  "reminder.email",
  "cancel.sms",
  "cancel.email",
  "moved.sms",
  "moved.email",
  "clinic.newLead.email",
  "clinic.cancelled.email",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** A code default (§9.2). `subject` only for e-mail. */
export type TemplateDefinition = {
  key: TemplateKey;
  channel: MessageChannel;
  kind: MessageKind;
  /** Label shown in Mesaje → Șabloane. */
  name: string;
  /** Who receives it: the patient or the clinic. Clinic templates may use `motiv`. */
  audience: "pacient" | "clinica";
  /** One-line explanation for the template list. */
  description: string;
  subject: string | null;
  body: string;
};

/** The effective template: the DB override when one exists, else the code default. */
export type ResolvedTemplate = TemplateDefinition & {
  overridden: boolean;
  active: boolean;
  updatedAt: string | null;
};

/** Result of sending one message on one channel. */
export type SendOutcome = { channel: MessageChannel; status: MessageStatus };

/** Summary returned by `runReminders` and `/api/cron/reminders` (§6.6 step 5). */
export type ReminderRunResult =
  | { skipped: "quiet-hours" | "disabled"; now: string }
  | {
      now: string;
      considered: number;
      sent: { sms: number; email: number };
      failed: number;
      skipped: number;
    };

/** Message log row as shown in the CRM (a DTO; never a Prisma row). */
export type MessageLogRow = {
  id: string;
  createdAt: string;
  channel: MessageChannel;
  kind: MessageKind;
  status: MessageStatus;
  to: string;
  subject: string | null;
  body: string;
  provider: string | null;
  error: string | null;
  patient: { id: string; name: string } | null;
  leadId: string | null;
  appointmentId: string | null;
  sentByName: string | null;
};

/** Editor preview of a draft template, rendered with sample variables. */
export type TemplatePreview = {
  subject: string | null;
  text: string;
  problems: { subject: string[]; body: string[] };
  /** SMS only: the text as sent (GSM-7 when diacritics are stripped) and its segments. */
  sms: { text: string; encoding: "GSM-7" | "UCS-2"; units: number; segments: number; perSegment: number } | null;
};
