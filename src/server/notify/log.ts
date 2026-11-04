import "server-only";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { normalizePhone } from "@/lib/validation/common";
import { localDayRangeUtc, isValidDateISO } from "@/lib/time";
import { sendManualMessage } from "./send";
import type { MessageChannel, MessageKind, MessageLogRow, MessageStatus } from "./types";

/** Message log queries and the manual send flow (Mesaje, docs/architecture.md §4.2). */

export const MESSAGE_PAGE_SIZE = 50;

const CHANNELS = ["EMAIL", "SMS"] as const;
const KINDS = ["CONFIRMARE_PROGRAMARE", "REMINDER", "ANULARE", "MODIFICARE", "NOTIFICARE_CLINICA", "RECHEMARE", "MANUAL"] as const;
const STATUSES = ["TRIMIS", "SIMULAT", "EROARE"] as const;

export type MessageLogFilters = {
  canal: MessageChannel | null;
  tip: MessageKind | null;
  status: MessageStatus | null;
  de: string | null;
  pana: string | null;
  pagina: number;
};

function pick<T extends string>(allowed: readonly T[], v: string | undefined): T | null {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** URL params → filters; invalid values are ignored. */
export function parseMessageLogFilters(params: Record<string, string | string[] | undefined>): MessageLogFilters {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const de = one("de");
  const pana = one("pana");
  const page = Number.parseInt(one("pagina") ?? "1", 10);
  return {
    canal: pick(CHANNELS, one("canal")),
    tip: pick(KINDS, one("tip")),
    status: pick(STATUSES, one("status")),
    de: de && isValidDateISO(de) ? de : null,
    pana: pana && isValidDateISO(pana) ? pana : null,
    pagina: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listMessageLog(f: MessageLogFilters): Promise<{ rows: MessageLogRow[]; total: number; pageCount: number }> {
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (f.de) createdAt.gte = localDayRangeUtc(f.de).start;
  if (f.pana) createdAt.lt = localDayRangeUtc(f.pana).end;
  const where = {
    ...(f.canal ? { channel: f.canal } : {}),
    ...(f.tip ? { kind: f.tip } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.de || f.pana ? { createdAt } : {}),
  };
  const total = await prisma.messageLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / MESSAGE_PAGE_SIZE));
  const page = Math.min(f.pagina, pageCount);
  const rows = await prisma.messageLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * MESSAGE_PAGE_SIZE,
    take: MESSAGE_PAGE_SIZE,
    select: {
      id: true,
      createdAt: true,
      channel: true,
      kind: true,
      status: true,
      to: true,
      subject: true,
      body: true,
      provider: true,
      error: true,
      patientId: true,
      leadId: true,
      appointmentId: true,
      sentById: true,
    },
  });
  const patientIds = [...new Set(rows.map((r) => r.patientId).filter((x): x is string => Boolean(x)))];
  const userIds = [...new Set(rows.map((r) => r.sentById).filter((x): x is string => Boolean(x)))];
  const [patients, users] = await Promise.all([
    patientIds.length
      ? prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
  ]);
  const patientName = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const userName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  return {
    total,
    pageCount,
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      channel: r.channel,
      kind: r.kind,
      status: r.status,
      to: r.to,
      subject: r.subject,
      body: r.body,
      provider: r.provider,
      error: r.error,
      patient: r.patientId ? { id: r.patientId, name: patientName.get(r.patientId) ?? "Pacient" } : null,
      leadId: r.leadId,
      appointmentId: r.appointmentId,
      sentByName: r.sentById ? (userName.get(r.sentById) ?? "Utilizator") : null,
    })),
  };
}

/**
 * Manual send (Mesaje, the patient file, a lead): when a patient or lead is given, the recipient
 * comes from their record, never from the form, and SMS requires their consent. Without one,
 * the typed recipient is validated for the channel.
 */
export async function sendManualFromStaff(
  i: { channel: MessageChannel; to?: string; subject?: string; body: string; patientId?: string; leadId?: string },
  sentById: string,
): Promise<{ status: MessageStatus }> {
  let to: string | null = null;
  if (i.patientId) {
    const p = await prisma.patient.findUnique({
      where: { id: i.patientId },
      select: {
        phone: true,
        email: true,
        smsOptIn: true,
        anonymizedAt: true,
        consents: { where: { type: "SMS", granted: true, revokedAt: null }, select: { id: true }, take: 1 },
      },
    });
    if (!p) throw new DomainError("NOT_FOUND", "Pacientul nu mai există. Reîncărcați pagina.");
    if (p.anonymizedAt) throw new DomainError("VALIDATION", "Pacientul a fost anonimizat; nu i se mai pot trimite mesaje.");
    if (i.channel === "SMS") {
      if (!p.phone) throw new DomainError("VALIDATION", "Pacientul nu are un număr de telefon. Adăugați-l în fișă.", { fieldErrors: { channel: ["Pacientul nu are un număr de telefon."] } });
      if (!p.smsOptIn && p.consents.length === 0) {
        throw new DomainError("VALIDATION", "Pacientul nu a acceptat SMS-uri. Sunați-l sau trimiteți un e-mail.", {
          fieldErrors: { channel: ["Pacientul nu a acceptat SMS-uri."] },
        });
      }
      to = p.phone;
    } else {
      if (!p.email) throw new DomainError("VALIDATION", "Pacientul nu are o adresă de e-mail. Adăugați-o în fișă.", { fieldErrors: { channel: ["Pacientul nu are o adresă de e-mail."] } });
      to = p.email;
    }
  } else if (i.leadId) {
    const l = await prisma.lead.findUnique({ where: { id: i.leadId }, select: { phone: true, email: true, consentSms: true, patientId: true } });
    if (!l) throw new DomainError("NOT_FOUND", "Cererea nu mai există. Reîncărcați pagina.");
    if (i.channel === "SMS") {
      if (!l.phone) throw new DomainError("VALIDATION", "Cererea nu are un număr de telefon.", { fieldErrors: { channel: ["Cererea nu are un număr de telefon."] } });
      if (!l.consentSms) {
        throw new DomainError("VALIDATION", "Persoana nu a acceptat SMS-uri. Sunați-o sau trimiteți un e-mail.", {
          fieldErrors: { channel: ["Persoana nu a acceptat SMS-uri."] },
        });
      }
      to = l.phone;
    } else {
      if (!l.email) throw new DomainError("VALIDATION", "Cererea nu are o adresă de e-mail.", { fieldErrors: { channel: ["Cererea nu are o adresă de e-mail."] } });
      to = l.email;
    }
  } else {
    const raw = (i.to ?? "").trim();
    if (i.channel === "SMS") {
      to = normalizePhone(raw);
      if (!to) throw new DomainError("VALIDATION", undefined, { fieldErrors: { to: ["Introduceți un număr de telefon, de exemplu 0745 123 456."] } });
    } else {
      const email = raw.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
        throw new DomainError("VALIDATION", undefined, { fieldErrors: { to: ["Introduceți o adresă de e-mail, de exemplu nume@exemplu.ro."] } });
      }
      to = email;
    }
  }
  if (i.channel === "EMAIL" && !i.subject?.trim()) {
    throw new DomainError("VALIDATION", undefined, { fieldErrors: { subject: ["Scrieți subiectul e-mailului."] } });
  }
  return sendManualMessage({
    channel: i.channel,
    to,
    subject: i.subject,
    body: i.body,
    patientId: i.patientId,
    leadId: i.leadId,
    sentById,
  });
}
