import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import type { Appointment, Prisma } from "@/generated/prisma/client";
import type { AppointmentStatus, CancelledBy, ConfirmationChannel } from "@/generated/prisma/enums";
import { findConflicts, withSchedulingTx } from "./conflicts";
import {
  ALLOWED_TRANSITIONS,
  BLOCKING_STATUSES,
  PATIENT_LINK_TRANSITIONS,
  canTransition,
  isBlockingStatus,
  requiresStarted,
} from "./rules";

/**
 * Appointment status machine (docs/architecture.md §6.4). The table and the role rules are pure
 * (rules.ts, re-exported here); `transitionAppointment` applies one transition with its side
 * effects and the audit row in one transaction. Notifications are the caller's job, after commit.
 */

export { ALLOWED_TRANSITIONS, BLOCKING_STATUSES, canTransition };
export { allowedTargets, isBlockingStatus, isUndo, PATIENT_LINK_TRANSITIONS } from "./rules";

export type TransitionContext = {
  /** null = the patient, through the `/p/[token]` link. */
  actor: CurrentUser | null;
  via?: ConfirmationChannel;
  cancelledBy?: CancelledBy;
  reason?: string;
  now?: Date;
};

function invalid(message = "Statusul nu poate fi schimbat astfel. Reîncărcați pagina și încercați din nou."): never {
  throw new DomainError("INVALID_TRANSITION", message);
}

/** The column changes of one transition (§6.4 side effects). Pure, exported for tests. */
export function transitionData(
  appt: Pick<Appointment, "status" | "confirmedAt">,
  to: AppointmentStatus,
  ctx: TransitionContext,
  now: Date,
): Prisma.AppointmentUpdateManyMutationInput {
  const from = appt.status;
  const data: Prisma.AppointmentUpdateManyMutationInput = { status: to, updatedById: ctx.actor?.id ?? null };
  switch (to) {
    case "CONFIRMAT":
      if (from === "SOSIT") {
        data.arrivedAt = null;
        if (!appt.confirmedAt) {
          data.confirmedAt = now;
          data.confirmedVia = ctx.via ?? "RECEPTIE";
        }
      } else {
        data.confirmedAt = now;
        data.confirmedVia = ctx.via ?? (ctx.actor ? "TELEFON" : "LINK");
      }
      break;
    case "PROGRAMAT":
      if (from === "CONFIRMAT") {
        data.confirmedAt = null;
        data.confirmedVia = null;
      } else if (from === "ANULAT") {
        data.cancelledAt = null;
        data.cancelledBy = null;
        data.cancelReason = null;
        data.confirmedAt = null;
        data.confirmedVia = null;
        data.reminderSentAt = null;
      } else if (from === "NEPREZENTAT") {
        data.noShowAt = null;
      }
      break;
    case "SOSIT":
      if (from === "IN_TRATAMENT") {
        data.startedAt = null;
      } else {
        data.arrivedAt = now;
        if (from === "NEPREZENTAT") data.noShowAt = null;
      }
      break;
    case "IN_TRATAMENT":
      if (from === "FINALIZAT") data.completedAt = null;
      else data.startedAt = now;
      break;
    case "FINALIZAT":
      data.completedAt = now;
      break;
    case "ANULAT":
      data.cancelledAt = now;
      data.cancelledBy = ctx.cancelledBy ?? (ctx.actor ? "CLINICA" : "PACIENT");
      data.cancelReason = ctx.reason?.slice(0, 500) ?? null;
      // §3.2 invariant 9: old links stop working and the reminder state resets.
      data.tokenVersion = { increment: 1 };
      data.reminderSentAt = null;
      break;
    case "NEPREZENTAT":
      data.noShowAt = now;
      break;
  }
  return data;
}

/**
 * Moves appointment `id` to `to`. Rejects illegal transitions with `INVALID_TRANSITION`, a MEDIC
 * acting on someone else's appointment with `FORBIDDEN`, a restore into an occupied slot with
 * `CONFLICT`, and a concurrent change with `STALE`. Writes `AuditLog appointment.status
 * { from, to }` in the same transaction. Repeating the current status is a no-op.
 */
export async function transitionAppointment(id: string, to: AppointmentStatus, ctx: TransitionContext): Promise<Appointment> {
  const now = ctx.now ?? new Date();
  return withSchedulingTx(async (tx) => {
    const appt = await tx.appointment.findUnique({ where: { id } });
    if (!appt) throw new DomainError("NOT_FOUND", "Programarea nu mai există. Reîncărcați pagina.");
    const from = appt.status;
    if (from === to) return appt;

    if (!ALLOWED_TRANSITIONS[from].includes(to)) invalid();
    if (ctx.actor) {
      if (ctx.actor.role === "MEDIC" && ctx.actor.doctorId !== appt.doctorId) {
        throw new DomainError("FORBIDDEN", "Puteți schimba doar statusul programărilor dumneavoastră.");
      }
      if (!canTransition(from, to, ctx.actor.role, appt.completedAt, now)) {
        if (from === "FINALIZAT") invalid("O vizită finalizată poate fi redeschisă doar de administrator, în cel mult 24 de ore.");
        invalid();
      }
    } else if (!PATIENT_LINK_TRANSITIONS.some(([f, t]) => f === from && t === to)) {
      invalid();
    }
    if (requiresStarted(to) && appt.startsAt.getTime() > now.getTime()) {
      invalid("Puteți marca pacientul ca neprezentat după ora programării.");
    }

    // A cancelled or no-show appointment freed its slot: it may come back only if the slot is still free.
    if (!isBlockingStatus(from) && isBlockingStatus(to)) {
      const conflicts = await findConflicts(
        tx,
        {
          appointmentId: appt.id,
          locationId: appt.locationId,
          doctorId: appt.doctorId,
          cabinetId: appt.cabinetId,
          patientId: appt.patientId,
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          wantsSedation: appt.wantsSedation,
        },
        { now },
      );
      const blocks = conflicts.filter((c) => c.severity === "block");
      if (blocks.length > 0) {
        throw new DomainError("CONFLICT", `Programarea nu poate fi readusă. ${blocks[0].message}`, {
          details: { conflicts },
        });
      }
    }

    const result = await tx.appointment.updateMany({
      where: { id, status: from },
      data: transitionData(appt, to, ctx, now),
    });
    if (result.count !== 1) throw new DomainError("STALE", "Programarea a fost modificată între timp. Reîncărcați pagina.");

    await audit(
      {
        action: "appointment.status",
        entityType: "Appointment",
        entityId: id,
        patientId: appt.patientId,
        metadata: ctx.actor ? { from, to } : { from, to, via: "link" },
      },
      { actor: ctx.actor, db: tx },
    );
    return tx.appointment.findUniqueOrThrow({ where: { id } });
  });
}
