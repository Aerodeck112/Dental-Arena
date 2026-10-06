import "server-only";
import { prisma, type Db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDateRo, formatPhone, formatTime } from "@/lib/format";
import { LEAD_SOURCE_LABEL } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { appointmentManageUrl } from "@/lib/tokens";
import { toGsm7 } from "./gsm";
import { sendMail } from "./mailer";
import { getSmsProvider } from "./sms";
import { renderTemplate, textToEmailHtml } from "./templates";
import type { MessageChannel, MessageKind, MessageStatus, SendOutcome, TemplateKey, TemplateVars } from "./types";

/**
 * Sending and logging (docs/architecture.md §6.6, §7.3, §9). Every send writes one `MessageLog`
 * row with the text actually sent. These functions never throw for a delivery failure: the row is
 * logged `EROARE` instead, because they usually run inside `after()`.
 */

type AppointmentMessageKind = "CONFIRMARE_PROGRAMARE" | "REMINDER" | "ANULARE" | "MODIFICARE";

const ALL_CHANNELS: MessageChannel[] = ["SMS", "EMAIL"];

// ─────────────────────────────── delivery ───────────────────────────────

type Delivery = {
  channel: MessageChannel;
  kind: MessageKind;
  to: string;
  subject?: string | null;
  text: string;
  patientId?: string | null;
  appointmentId?: string | null;
  leadId?: string | null;
  sentById?: string | null;
  /** Transliterate SMS to GSM-7 (settings.reminders.smsStripDiacritics). */
  stripDiacritics?: boolean;
};

/** Short error description for `MessageLog.error` (never printed to the server log). */
function describeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 300);
  return "Eroare necunoscută";
}

async function clinicReplyTo(): Promise<string | undefined> {
  try {
    return (await getSettings("clinic")).email || undefined;
  } catch {
    return undefined;
  }
}

/** Sends one message through the provider of its channel and writes `MessageLog`. */
export async function deliver(d: Delivery, db: Db = prisma): Promise<MessageStatus> {
  let status: MessageStatus;
  let provider: string | null = null;
  let providerMessageId: string | null = null;
  let error: string | null = null;
  let body = d.text;
  const subject = d.channel === "EMAIL" ? (d.subject ?? "Dental Arena") : null;

  try {
    if (d.channel === "SMS") {
      if (d.stripDiacritics) body = toGsm7(body);
      const sms = getSmsProvider();
      provider = sms.name;
      const r = await sms.send(d.to, body);
      providerMessageId = r.providerMessageId ?? null;
      status = sms.simulated ? "SIMULAT" : "TRIMIS";
    } else {
      const clinicName = (await getSettings("clinic").catch(() => null))?.displayName ?? "Dental Arena";
      const r = await sendMail({
        to: d.to,
        subject: subject ?? "Dental Arena",
        text: body,
        html: textToEmailHtml(body, clinicName),
        replyTo: await clinicReplyTo(),
      });
      provider = r.provider;
      providerMessageId = r.messageId ?? null;
      status = r.provider === "console" ? "SIMULAT" : "TRIMIS";
    }
  } catch (e) {
    status = "EROARE";
    error = describeError(e);
    console.error(`[notify] trimitere eșuată: ${d.channel} ${d.kind} (${e instanceof Error ? e.name : typeof e})`);
  }

  await db.messageLog.create({
    data: {
      channel: d.channel,
      kind: d.kind,
      status,
      to: d.to,
      subject,
      body,
      provider,
      providerMessageId,
      error,
      patientId: d.patientId ?? null,
      appointmentId: d.appointmentId ?? null,
      leadId: d.leadId ?? null,
      sentById: d.sentById ?? null,
    },
  });
  return status;
}

// ─────────────────────────────── appointment context ───────────────────────────────

const appointmentSelect = {
  id: true,
  status: true,
  startsAt: true,
  tokenVersion: true,
  patientId: true,
  leadId: true,
  cancelReason: true,
  location: { select: { name: true, shortName: true, street: true, city: true, county: true, phone: true } },
  doctor: { select: { publicName: true } },
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      smsOptIn: true,
      anonymizedAt: true,
      consents: { where: { type: "SMS", granted: true, revokedAt: null }, select: { id: true }, take: 1 },
    },
  },
  lead: { select: { id: true, name: true, phone: true, email: true, consentSms: true } },
} as const;

export type AppointmentForMessage = NonNullable<Awaited<ReturnType<typeof loadAppointmentForMessage>>>;

export async function loadAppointmentForMessage(appointmentId: string, db: Db = prisma) {
  return db.appointment.findUnique({ where: { id: appointmentId }, select: appointmentSelect });
}

/** Who the message goes to: the patient, or the lead while there is no patient (§6.6 step 4.2). */
export function resolveContact(a: AppointmentForMessage): {
  firstName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  smsConsent: boolean;
  anonymized: boolean;
} | null {
  if (a.patient) {
    const p = a.patient;
    return {
      firstName: p.firstName,
      fullName: `${p.firstName} ${p.lastName}`.trim(),
      phone: p.phone,
      email: p.email,
      smsConsent: p.smsOptIn || p.consents.length > 0 || Boolean(a.lead?.consentSms),
      anonymized: p.anonymizedAt !== null,
    };
  }
  if (a.lead) {
    const name = a.lead.name.trim();
    return {
      firstName: name.split(/\s+/)[0] ?? name,
      fullName: name,
      phone: a.lead.phone,
      email: a.lead.email,
      smsConsent: a.lead.consentSms,
      anonymized: false,
    };
  }
  return null;
}

export function locationAddress(l: { street: string; city: string; county: string }): string {
  return `${l.street}, ${l.city}, jud. ${l.county}`;
}

/** Template variables for a patient message (§9.2). Never includes `motiv`. */
export function appointmentVariables(a: AppointmentForMessage, contact: { firstName: string; fullName: string }): TemplateVars {
  return {
    prenume: contact.firstName,
    nume: contact.fullName,
    data: formatDateRo(a.startsAt, "long"),
    ora: formatTime(a.startsAt),
    clinica: a.location.name,
    clinicaScurt: a.location.shortName,
    adresa: locationAddress(a.location),
    telefonClinica: formatPhone(a.location.phone),
    medic: a.doctor.publicName,
    link: appointmentManageUrl({ id: a.id, tokenVersion: a.tokenVersion, startsAt: a.startsAt }),
  };
}

/** Template key for a kind and channel. A booking that is still PROGRAMAT gets „cerere primită”. */
export function templateKeyFor(kind: AppointmentMessageKind, channel: MessageChannel, status?: string): TemplateKey {
  const suffix = channel === "SMS" ? "sms" : "email";
  switch (kind) {
    case "CONFIRMARE_PROGRAMARE":
      if (channel === "EMAIL" && status === "PROGRAMAT") return "booking.received.email";
      return `booking.confirmed.${suffix}`;
    case "REMINDER":
      return `reminder.${suffix}`;
    case "ANULARE":
      return `cancel.${suffix}`;
    case "MODIFICARE":
      return `moved.${suffix}`;
  }
}

/**
 * Renders and sends one appointment message on the given channels, honouring consent: SMS needs a
 * phone and SMS consent, e-mail needs an address. Channels that cannot be used are left out of the
 * result.
 */
export async function sendForAppointment(
  kind: AppointmentMessageKind,
  a: AppointmentForMessage,
  channels: MessageChannel[],
  o: { sentById?: string | null; stripDiacritics: boolean; db?: Db },
): Promise<SendOutcome[]> {
  const contact = resolveContact(a);
  if (!contact || contact.anonymized) return [];
  const vars = appointmentVariables(a, contact);
  const outcomes: SendOutcome[] = [];
  for (const channel of channels) {
    const to = channel === "SMS" ? (contact.smsConsent ? contact.phone : null) : contact.email;
    if (!to) continue;
    const rendered = await renderTemplate(templateKeyFor(kind, channel, a.status), vars, o.db);
    if (!rendered) continue;
    const status = await deliver(
      {
        channel,
        kind,
        to,
        subject: rendered.subject,
        text: rendered.text,
        patientId: a.patientId,
        appointmentId: a.id,
        leadId: a.leadId,
        sentById: o.sentById ?? null,
        stripDiacritics: o.stripDiacritics,
      },
      o.db,
    );
    outcomes.push({ channel, status });
  }
  return outcomes;
}

// ─────────────────────────────── contracts (§7.3) ───────────────────────────────

/** Sends an appointment message to the patient (or lead). Default channels: SMS and e-mail. */
export async function sendAppointmentMessage(
  kind: AppointmentMessageKind,
  appointmentId: string,
  o?: { channels?: MessageChannel[]; sentById?: string | null },
): Promise<SendOutcome[]> {
  const a = await loadAppointmentForMessage(appointmentId);
  if (!a) return [];
  const reminders = await getSettings("reminders");
  return sendForAppointment(kind, a, o?.channels ?? ALL_CHANNELS, {
    sentById: o?.sentById ?? null,
    stripDiacritics: reminders.smsStripDiacritics,
  });
}

/** E-mails the clinic about a new lead. Health details stay in the CRM (§9.2). */
export async function notifyClinicNewLead(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, source: true, location: { select: { name: true } } },
  });
  if (!lead) return;
  const rendered = await renderTemplate("clinic.newLead.email", {
    nume: lead.name,
    prenume: lead.name.split(/\s+/)[0],
    motiv: LEAD_SOURCE_LABEL[lead.source],
    clinica: lead.location?.name ?? "nespecificată",
    link: `${env.APP_URL}/crm/cereri/${lead.id}`,
  });
  if (!rendered) return;
  await deliver({
    channel: "EMAIL",
    kind: "NOTIFICARE_CLINICA",
    to: env.CLINIC_NOTIFY_EMAIL,
    subject: rendered.subject,
    text: rendered.text,
    leadId: lead.id,
  });
}

/** E-mails the clinic when a patient cancels through a `/p/[token]` link. */
export async function notifyClinicCancellation(appointmentId: string): Promise<void> {
  const a = await loadAppointmentForMessage(appointmentId);
  if (!a) return;
  const contact = resolveContact(a);
  const name = contact ? (contact.anonymized ? "Un pacient" : contact.fullName) : "Un pacient";
  const rendered = await renderTemplate("clinic.cancelled.email", {
    nume: name,
    prenume: contact?.firstName ?? "",
    data: formatDateRo(a.startsAt, "long"),
    ora: formatTime(a.startsAt),
    clinica: a.location.name,
    clinicaScurt: a.location.shortName,
    adresa: locationAddress(a.location),
    telefonClinica: formatPhone(a.location.phone),
    medic: a.doctor.publicName,
    link: `${env.APP_URL}/crm/programari/${a.id}`,
    motiv: a.cancelReason ?? "",
  });
  if (!rendered) return;
  await deliver({
    channel: "EMAIL",
    kind: "NOTIFICARE_CLINICA",
    to: env.CLINIC_NOTIFY_EMAIL,
    subject: rendered.subject,
    text: rendered.text,
    patientId: a.patientId,
    appointmentId: a.id,
    leadId: a.leadId,
  });
}

/** A message written by staff in Mesaje or on the patient file (`SendMessageDialog`). */
export async function sendManualMessage(i: {
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
  patientId?: string;
  leadId?: string;
  sentById: string;
}): Promise<{ status: MessageStatus }> {
  const reminders = await getSettings("reminders");
  const status = await deliver({
    channel: i.channel,
    kind: "MANUAL",
    to: i.to,
    subject: i.channel === "EMAIL" ? (i.subject?.trim() || "Mesaj de la Dental Arena") : null,
    text: i.body,
    patientId: i.patientId ?? null,
    leadId: i.leadId ?? null,
    sentById: i.sentById,
    stripDiacritics: reminders.smsStripDiacritics,
  });
  return { status };
}
