import "server-only";
import type { ToothConditionType } from "@/generated/prisma/enums";
import { canonicalSurfaces, isFdiTooth } from "@/components/crm/odontogram/fdi";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { assertPatientEditable } from "./service";
import type { ToothConditionDTO } from "./types";

/**
 * Odontogram (docs/architecture.md WP7, design system §6.8). Findings per tooth are rows of
 * `ToothCondition`; a row is never edited, it is resolved (`resolvedAt`) when the tooth changes
 * („caria devine obturație”), so the chart keeps its history. ADMIN and MEDIC only.
 */

function assertMedical(user: CurrentUser, write = false) {
  if (!can(user, write ? "medical.edit" : "medical.view")) {
    throw new DomainError("FORBIDDEN", "Odontograma este vizibilă doar medicilor și administratorilor.");
  }
}

/** Conditions that describe the whole tooth and replace each other on the same tooth. */
const WHOLE_TOOTH: ToothConditionType[] = ["EXTRAS", "LIPSA", "IMPLANT", "RADACINA_RESTANTA", "INCLUS"];

/**
 * Pure: the ids of active rows a new finding supersedes. With `replaceExisting`, every active row
 * of the tooth. Otherwise only the same condition on overlapping surfaces (a duplicate), and the
 * other whole-tooth states (an extracted tooth that receives an implant).
 */
export function supersededIds(
  active: { id: string; tooth: number; condition: ToothConditionType; surfaces: string | null }[],
  next: { tooth: number; condition: ToothConditionType; surfaces: string | null },
  replaceExisting: boolean,
): string[] {
  return active
    .filter((r) => r.tooth === next.tooth)
    .filter((r) => {
      if (replaceExisting) return true;
      if (WHOLE_TOOTH.includes(next.condition) && WHOLE_TOOTH.includes(r.condition)) return true;
      if (r.condition !== next.condition) return false;
      if (!r.surfaces || !next.surfaces) return true;
      return [...next.surfaces].some((s) => r.surfaces!.includes(s));
    })
    .map((r) => r.id);
}

/** Pure: active rows grouped by tooth, for the chart. */
export function groupByTooth<T extends { tooth: number; resolvedAt: string | null }>(rows: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const r of rows) {
    if (r.resolvedAt) continue;
    const list = out.get(r.tooth) ?? [];
    list.push(r);
    out.set(r.tooth, list);
  }
  return out;
}

export async function listToothConditions(user: CurrentUser, patientId: string): Promise<ToothConditionDTO[]> {
  assertMedical(user);
  const rows = await prisma.toothCondition.findMany({
    where: { patientId },
    orderBy: [{ tooth: "asc" }, { recordedAt: "desc" }],
    take: 2000,
  });
  const ids = [...new Set(rows.map((r) => r.recordedById).filter((v): v is string => Boolean(v)))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const names = new Map(users.map((u) => [u.id, personName(u)]));
  return rows.map((r) => ({
    id: r.id,
    tooth: r.tooth,
    surfaces: r.surfaces,
    condition: r.condition,
    notes: r.notes,
    recordedAt: r.recordedAt.toISOString(),
    recordedBy: r.recordedById ? (names.get(r.recordedById) ?? null) : null,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));
}

export async function addToothCondition(
  actor: CurrentUser,
  patientId: string,
  i: { tooth: number; condition: ToothConditionType; surfaces?: string | null; notes?: string | null; replaceExisting?: boolean },
  now: Date = new Date(),
): Promise<{ id: string; resolved: number }> {
  assertMedical(actor, true);
  if (!isFdiTooth(i.tooth)) {
    throw new DomainError("VALIDATION", "Alegeți un dinte valid.", { fieldErrors: { tooth: ["Alegeți un dinte valid (numerotare FDI, de exemplu 36)."] } });
  }
  const surfaces = canonicalSurfaces(i.tooth, i.surfaces);
  return prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    const active = await tx.toothCondition.findMany({
      where: { patientId, tooth: i.tooth, resolvedAt: null },
      select: { id: true, tooth: true, condition: true, surfaces: true },
    });
    const old = supersededIds(active, { tooth: i.tooth, condition: i.condition, surfaces }, Boolean(i.replaceExisting));
    if (old.length) await tx.toothCondition.updateMany({ where: { id: { in: old } }, data: { resolvedAt: now } });
    const row = await tx.toothCondition.create({
      data: { patientId, tooth: i.tooth, condition: i.condition, surfaces, notes: i.notes ?? null, recordedAt: now, recordedById: actor.id },
      select: { id: true },
    });
    await audit(
      {
        action: "medical.update",
        entityType: "ToothCondition",
        entityId: row.id,
        patientId,
        metadata: { fields: ["toothCondition"], tooth: i.tooth, resolved: old.length },
      },
      { actor, db: tx },
    );
    return { id: row.id, resolved: old.length };
  });
}

export async function resolveToothCondition(actor: CurrentUser, patientId: string, conditionId: string, now: Date = new Date()): Promise<void> {
  assertMedical(actor, true);
  await prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    const c = await tx.toothCondition.findFirst({ where: { id: conditionId, patientId }, select: { id: true, resolvedAt: true, tooth: true } });
    if (!c) throw new DomainError("NOT_FOUND", "Constatarea nu a fost găsită.");
    if (c.resolvedAt) throw new DomainError("CONFLICT", "Constatarea este deja rezolvată.");
    await tx.toothCondition.update({ where: { id: c.id }, data: { resolvedAt: now } });
    await audit(
      { action: "medical.update", entityType: "ToothCondition", entityId: c.id, patientId, metadata: { fields: ["resolvedAt"], tooth: c.tooth } },
      { actor, db: tx },
    );
  });
}
