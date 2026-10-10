import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { assertPatientEditable } from "./service";
import type { MedicalHistoryDTO } from "./types";

/**
 * Anamneză (docs/architecture.md §5.2, §8.4). Only ADMIN and MEDIC read or write it; RECEPTIE gets
 * the derived flags (`flags.ts`) and nothing else, enforced here and not only in the UI.
 */

export const MEDICAL_BOOLEAN_FIELDS = [
  "anticoagulants",
  "bleedingDisorder",
  "bisphosphonates",
  "cardiacDisease",
  "hypertension",
  "diabetes",
  "asthma",
  "epilepsy",
  "hepatitis",
  "hiv",
  "pregnancy",
  "smoker",
] as const;

export type MedicalBooleanField = (typeof MEDICAL_BOOLEAN_FIELDS)[number];

/** Checkbox labels of the anamneză form (the alert ones are also flags). */
export const MEDICAL_FIELD_LABEL: Record<MedicalBooleanField, string> = {
  anticoagulants: "Ia anticoagulante (de exemplu Sintrom, Xarelto, aspirină zilnic)",
  bleedingDisorder: "Tulburări de coagulare",
  bisphosphonates: "Tratament cu bifosfonați (osteoporoză)",
  cardiacDisease: "Boală cardiacă",
  hypertension: "Hipertensiune arterială",
  diabetes: "Diabet",
  asthma: "Astm",
  epilepsy: "Epilepsie",
  hepatitis: "Hepatită",
  hiv: "Infecție HIV",
  pregnancy: "Sarcină în curs",
  smoker: "Fumător",
};

export type MedicalHistoryInput = {
  allergies?: string | null;
  medications?: string | null;
  otherConditions?: string | null;
} & Record<MedicalBooleanField, boolean>;

function assertMedical(user: CurrentUser, write = false) {
  if (!can(user, write ? "medical.edit" : "medical.view")) {
    throw new DomainError("FORBIDDEN", "Anamneza este vizibilă doar medicilor și administratorilor.");
  }
}

export async function getMedicalHistory(user: CurrentUser, patientId: string): Promise<MedicalHistoryDTO | null> {
  assertMedical(user);
  const m = await prisma.medicalHistory.findUnique({ where: { patientId } });
  if (!m) return null;
  const reviewer = m.lastReviewedByUserId
    ? await prisma.user.findUnique({ where: { id: m.lastReviewedByUserId }, select: { firstName: true, lastName: true } })
    : null;
  return {
    allergies: m.allergies,
    medications: m.medications,
    anticoagulants: m.anticoagulants,
    cardiacDisease: m.cardiacDisease,
    hypertension: m.hypertension,
    diabetes: m.diabetes,
    asthma: m.asthma,
    epilepsy: m.epilepsy,
    hepatitis: m.hepatitis,
    hiv: m.hiv,
    bleedingDisorder: m.bleedingDisorder,
    bisphosphonates: m.bisphosphonates,
    pregnancy: m.pregnancy,
    smoker: m.smoker,
    otherConditions: m.otherConditions,
    lastReviewedAt: m.lastReviewedAt?.toISOString() ?? null,
    lastReviewedBy: reviewer ? personName(reviewer) : null,
  };
}

/**
 * Saves the anamneză. Saving always counts as a review: `lastReviewedAt` and the reviewer are set
 * even when nothing changed. Audited as `medical.update` with the names of the changed fields.
 */
export async function saveMedicalHistory(
  actor: CurrentUser,
  patientId: string,
  i: MedicalHistoryInput,
  now: Date = new Date(),
): Promise<{ changed: string[] }> {
  assertMedical(actor, true);
  return prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    const before = await tx.medicalHistory.findUnique({ where: { patientId } });
    const data = {
      allergies: i.allergies ?? null,
      medications: i.medications ?? null,
      otherConditions: i.otherConditions ?? null,
      ...Object.fromEntries(MEDICAL_BOOLEAN_FIELDS.map((k) => [k, Boolean(i[k])])),
    } as Record<string, string | boolean | null>;
    const changed = Object.keys(data).filter((k) => {
      const prev = before ? (before as unknown as Record<string, unknown>)[k] : k in i ? (typeof data[k] === "boolean" ? false : null) : null;
      return (prev ?? null) !== (data[k] ?? null);
    });
    await tx.medicalHistory.upsert({
      where: { patientId },
      create: { patientId, ...data, lastReviewedAt: now, lastReviewedByUserId: actor.id },
      update: { ...data, lastReviewedAt: now, lastReviewedByUserId: actor.id },
    });
    await audit(
      {
        action: "medical.update",
        entityType: "MedicalHistory",
        entityId: patientId,
        patientId,
        metadata: { fields: changed, reviewed: true },
      },
      { actor, db: tx },
    );
    return { changed };
  });
}
