import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { diffDaysISO, localDayRangeUtc, addDaysISO, todayISO, utcToLocal } from "@/lib/time";
import { zId, zOptionalText } from "@/lib/validation/common";
import type { Prisma } from "@/generated/prisma/client";
import type { RecallStatus } from "@/generated/prisma/enums";
import { shortDoctorName } from "@/server/appointments/calendar";
import type { RecallOutcome, RecallRow } from "@/server/appointments/types";

/**
 * „De rechemat” (WP6): the due list, call attempts with outcome and note, „Programați” (the
 * appointment form marks the recall PROGRAMAT, see `createAppointment`), refused and cancelled
 * states. A MEDIC sees only their own recalls, read-only (§5.2).
 */

export const RECALL_OUTCOME_LABEL: Record<RecallOutcome, string> = {
  FARA_RASPUNS: "Nu a răspuns",
  REVINE: "A răspuns, revine să se programeze",
  REFUZAT: "Nu dorește programare",
};

/** Status after an attempt: no answer keeps the recall open as it was; a talk marks it Contactat. Pure. */
export function statusAfterAttempt(current: RecallStatus, outcome: RecallOutcome): RecallStatus {
  if (outcome === "REFUZAT") return "REFUZAT";
  if (outcome === "REVINE") return "CONTACTAT";
  return current;
}

export type RecallView = "de-facut" | "toate" | "inchise";

export async function listRecalls(
  user: CurrentUser,
  f: { view: RecallView; locationIds: string[]; horizonDays?: number },
  now: Date = new Date(),
): Promise<RecallRow[]> {
  const today = todayISO(now);
  const horizon = localDayRangeUtc(addDaysISO(today, f.horizonDays ?? 30)).end;
  const statusFilter: Prisma.RecallWhereInput =
    f.view === "de-facut"
      ? { status: { in: ["DE_FACUT", "CONTACTAT"] }, dueDate: { lt: horizon } }
      : f.view === "inchise"
        ? { status: { in: ["PROGRAMAT", "REFUZAT", "ANULAT"] } }
        : {};
  const rows = await prisma.recall.findMany({
    where: {
      ...statusFilter,
      ...(user.role === "MEDIC" ? { doctorId: user.doctorId ?? "__niciunul__" } : {}),
      OR: [{ locationId: { in: f.locationIds } }, { locationId: null }],
    },
    orderBy: f.view === "inchise" ? [{ updatedAt: "desc" }] : [{ dueDate: "asc" }],
    take: 300,
    select: {
      id: true,
      reason: true,
      dueDate: true,
      status: true,
      attempts: true,
      lastAttemptAt: true,
      outcomeNote: true,
      bookedAppointmentId: true,
      location: { select: { shortName: true } },
      doctor: { select: { honorific: true, lastName: true } },
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, anonymizedAt: true } },
    },
  });
  return rows
    .filter((r) => !r.patient.anonymizedAt)
    .map((r) => {
      const due = utcToLocal(r.dueDate).dateISO;
      return {
        id: r.id,
        patientId: r.patient.id,
        patientName: personName(r.patient),
        phone: r.patient.phone,
        reason: r.reason,
        dueDate: due,
        status: r.status,
        attempts: r.attempts,
        locationName: r.location?.shortName ?? null,
        doctorName: r.doctor ? shortDoctorName(r.doctor) : null,
        lastAttemptAt: r.lastAttemptAt?.toISOString() ?? null,
        outcomeNote: r.outcomeNote,
        bookedAppointmentId: r.bookedAppointmentId,
        dueInDays: diffDaysISO(today, due),
      };
    });
}

export const recallAttemptSchema = z.object({
  id: zId,
  outcome: z.enum(["FARA_RASPUNS", "REVINE", "REFUZAT"], { error: "Alegeți rezultatul apelului." }),
  note: zOptionalText(1000),
});

/** Logs one call attempt: attempts + 1, the time, the outcome and note, and the resulting status. */
export async function logRecallAttempt(i: z.output<typeof recallAttemptSchema>, actor: CurrentUser, now: Date = new Date()): Promise<{ status: RecallStatus }> {
  const recall = await prisma.recall.findUnique({ where: { id: i.id }, select: { status: true } });
  if (!recall) throw new DomainError("NOT_FOUND", "Rechemarea nu mai există. Reîncărcați pagina.");
  if (recall.status !== "DE_FACUT" && recall.status !== "CONTACTAT") {
    throw new DomainError("INVALID_TRANSITION", "Rechemarea este închisă. Redeschideți-o înainte de a nota un apel.");
  }
  const status = statusAfterAttempt(recall.status, i.outcome);
  const stamp = `${utcToLocal(now).dateISO.split("-").reverse().join(".")}, ${actor.firstName}`;
  const outcomeNote = `${RECALL_OUTCOME_LABEL[i.outcome]}${i.note ? `: ${i.note}` : ""} (${stamp})`;
  const res = await prisma.recall.updateMany({
    where: { id: i.id, status: recall.status },
    data: { attempts: { increment: 1 }, lastAttemptAt: now, outcomeNote: outcomeNote.slice(0, 1000), status },
  });
  if (res.count !== 1) throw new DomainError("STALE", "Rechemarea a fost modificată între timp. Reîncărcați pagina.");
  return { status };
}

export const recallStatusSchema = z.object({
  id: zId,
  status: z.enum(["DE_FACUT", "ANULAT"]),
  note: zOptionalText(500),
});

/** Cancels a recall (no longer needed) or reopens a closed one. */
export async function setRecallStatus(i: z.output<typeof recallStatusSchema>, actor: CurrentUser): Promise<void> {
  const recall = await prisma.recall.findUnique({ where: { id: i.id }, select: { status: true, outcomeNote: true } });
  if (!recall) throw new DomainError("NOT_FOUND", "Rechemarea nu mai există. Reîncărcați pagina.");
  if (recall.status === i.status) return;
  if (i.status === "ANULAT" && recall.status === "PROGRAMAT") {
    throw new DomainError("INVALID_TRANSITION", "Rechemarea are deja o programare. Anulați programarea din calendar.");
  }
  await prisma.recall.update({
    where: { id: i.id },
    data: {
      status: i.status,
      ...(i.status === "DE_FACUT" ? { bookedAppointmentId: null } : {}),
      ...(i.note ? { outcomeNote: `${i.note} (${actor.firstName})`.slice(0, 1000) } : {}),
    },
  });
}
