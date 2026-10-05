import "server-only";
import type { CurrentUser } from "./auth/dal";
import { prisma, type Db } from "./db";
import { getIpHash } from "./request";

/**
 * Append-only audit trail (docs/architecture.md §8.4). Metadata stores field names and ids,
 * never personal values. There is no update or delete path for audit rows.
 */

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.failed"
  | "user.create"
  | "user.update"
  | "user.deactivate"
  | "patient.create"
  | "patient.update"
  | "patient.view"
  | "patient.cnp.reveal"
  | "patient.export"
  | "patient.anonymize"
  | "medical.update"
  | "consent.record"
  | "consent.revoke"
  | "document.upload"
  | "document.download"
  | "document.delete"
  | "appointment.create"
  | "appointment.update"
  | "appointment.move"
  | "appointment.status"
  | "booking.create"
  | "lead.update"
  | "lead.convert"
  | "plan.update"
  | "invoice.create"
  | "invoice.cancel"
  | "payment.create"
  | "payment.cancel"
  | "catalog.update"
  | "schedule.update"
  | "settings.update"
  | "template.update"
  | "report.export"
  | "gdpr.request";

/** Romanian labels for the audit viewer. */
export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "auth.login": "Autentificare",
  "auth.logout": "Ieșire din cont",
  "auth.failed": "Autentificare eșuată",
  "user.create": "Utilizator creat",
  "user.update": "Utilizator modificat",
  "user.deactivate": "Utilizator dezactivat",
  "patient.create": "Pacient creat",
  "patient.update": "Pacient modificat",
  "patient.view": "Fișă vizualizată",
  "patient.cnp.reveal": "CNP afișat",
  "patient.export": "Date exportate",
  "patient.anonymize": "Pacient anonimizat",
  "medical.update": "Anamneză modificată",
  "consent.record": "Consimțământ înregistrat",
  "consent.revoke": "Consimțământ retras",
  "document.upload": "Document încărcat",
  "document.download": "Document descărcat",
  "document.delete": "Document șters",
  "appointment.create": "Programare creată",
  "appointment.update": "Programare modificată",
  "appointment.move": "Programare mutată",
  "appointment.status": "Status schimbat",
  "booking.create": "Programare online",
  "lead.update": "Cerere modificată",
  "lead.convert": "Cerere convertită",
  "plan.update": "Plan de tratament modificat",
  "invoice.create": "Factură emisă",
  "invoice.cancel": "Factură anulată",
  "payment.create": "Încasare înregistrată",
  "payment.cancel": "Încasare anulată",
  "catalog.update": "Servicii modificate",
  "schedule.update": "Program modificat",
  "settings.update": "Setări modificate",
  "template.update": "Șablon modificat",
  "report.export": "Raport exportat",
  "gdpr.request": "Cerere GDPR",
};

async function currentIpHash(): Promise<string | null> {
  try {
    return await getIpHash();
  } catch {
    // Outside a request (cron job, seed, tests): no IP.
    return null;
  }
}

/**
 * Writes one audit row. Pass `db` to write inside the caller's transaction; errors propagate, so
 * a sensitive action never succeeds without its audit row.
 */
export async function audit(
  e: {
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    patientId?: string | null;
    metadata?: Record<string, unknown>;
  },
  o: { actor?: CurrentUser | null; db?: Db } = {},
): Promise<void> {
  const db = o.db ?? prisma;
  const actor = o.actor ?? null;
  await db.auditLog.create({
    data: {
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      patientId: e.patientId ?? null,
      actorId: actor?.id ?? null,
      actorName: actor?.displayName ?? null,
      actorRole: actor?.role ?? null,
      ipHash: await currentIpHash(),
      metadata: e.metadata && Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : null,
    },
  });
}
