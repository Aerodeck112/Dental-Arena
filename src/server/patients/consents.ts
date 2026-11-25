import "server-only";
import type { ConsentMethod, ConsentType } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { assertPatientEditable } from "./service";
import type { ConsentDTO } from "./types";

/**
 * Consent evidence (docs/architecture.md §8.4): type, granted or refused, method, text version,
 * timestamps, the linked scan, who recorded it. Consents are never edited, only revoked; a new
 * decision is a new row, so the history stays readable.
 *
 * SMS and e-mail consents keep `Patient.smsOptIn` / `emailOptIn` in step.
 */

export async function listConsents(patientId: string): Promise<ConsentDTO[]> {
  const rows = await prisma.consent.findMany({
    where: { patientId },
    orderBy: { grantedAt: "desc" },
    include: {
      document: { select: { id: true, title: true, deletedAt: true } },
      treatmentPlan: { select: { title: true } },
    },
  });
  const recorderIds = [...new Set(rows.map((r) => r.recordedById).filter((v): v is string => Boolean(v)))];
  const users = recorderIds.length
    ? await prisma.user.findMany({ where: { id: { in: recorderIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, personName(u)]));
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    granted: r.granted,
    method: r.method,
    textVersion: r.textVersion,
    grantedAt: r.grantedAt.toISOString(),
    revokedAt: r.revokedAt?.toISOString() ?? null,
    recordedBy: r.recordedById ? (names.get(r.recordedById) ?? null) : null,
    notes: r.notes,
    document: r.document && !r.document.deletedAt ? { id: r.document.id, title: r.document.title } : null,
    planTitle: r.treatmentPlan?.title ?? null,
  }));
}

/** The latest decision per consent type that is still in force (not revoked). */
export function currentConsents<T extends { type: ConsentType; granted: boolean; grantedAt: string; revokedAt: string | null }>(
  rows: T[],
): Map<ConsentType, T> {
  const out = new Map<ConsentType, T>();
  for (const r of [...rows].sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))) {
    if (out.has(r.type)) continue;
    out.set(r.type, r);
  }
  for (const [k, v] of out) if (v.revokedAt) out.delete(k);
  return out;
}

async function syncOptIn(tx: Tx, patientId: string, type: ConsentType, value: boolean) {
  if (type === "SMS") await tx.patient.update({ where: { id: patientId }, data: { smsOptIn: value } });
  if (type === "EMAIL") await tx.patient.update({ where: { id: patientId }, data: { emailOptIn: value } });
}

export async function recordConsent(
  actor: CurrentUser,
  patientId: string,
  i: {
    type: ConsentType;
    granted: boolean;
    method: ConsentMethod;
    textVersion: string;
    documentId?: string | null;
    treatmentPlanId?: string | null;
    notes?: string | null;
  },
  now: Date = new Date(),
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    if (i.documentId) {
      const doc = await tx.patientDocument.findFirst({ where: { id: i.documentId, patientId, deletedAt: null }, select: { id: true } });
      if (!doc) {
        throw new DomainError("VALIDATION", "Documentul ales nu aparține acestui pacient.", {
          fieldErrors: { documentId: ["Alegeți un document din fișa pacientului."] },
        });
      }
    }
    if (i.treatmentPlanId) {
      const plan = await tx.treatmentPlan.findFirst({ where: { id: i.treatmentPlanId, patientId }, select: { id: true } });
      if (!plan) {
        throw new DomainError("VALIDATION", "Planul ales nu aparține acestui pacient.", {
          fieldErrors: { treatmentPlanId: ["Alegeți un plan din fișa pacientului."] },
        });
      }
    }
    // A new decision supersedes the previous one of the same type.
    await tx.consent.updateMany({ where: { patientId, type: i.type, revokedAt: null }, data: { revokedAt: now } });
    const row = await tx.consent.create({
      data: {
        patientId,
        type: i.type,
        granted: i.granted,
        method: i.method,
        textVersion: i.textVersion,
        grantedAt: now,
        documentId: i.documentId ?? null,
        treatmentPlanId: i.treatmentPlanId ?? null,
        notes: i.notes ?? null,
        recordedById: actor.id,
      },
      select: { id: true },
    });
    await syncOptIn(tx, patientId, i.type, i.granted);
    await audit(
      {
        action: "consent.record",
        entityType: "Consent",
        entityId: row.id,
        patientId,
        metadata: { type: i.type, granted: i.granted, method: i.method, textVersion: i.textVersion },
      },
      { actor, db: tx },
    );
    return row;
  });
}

export async function revokeConsent(actor: CurrentUser, patientId: string, consentId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    const c = await tx.consent.findFirst({ where: { id: consentId, patientId }, select: { id: true, type: true, revokedAt: true } });
    if (!c) throw new DomainError("NOT_FOUND", "Consimțământul nu a fost găsit.");
    if (c.revokedAt) throw new DomainError("CONFLICT", "Consimțământul a fost deja retras.");
    await tx.consent.update({ where: { id: c.id }, data: { revokedAt: now } });
    await syncOptIn(tx, patientId, c.type, false);
    await audit(
      { action: "consent.revoke", entityType: "Consent", entityId: c.id, patientId, metadata: { type: c.type } },
      { actor, db: tx },
    );
  });
}
