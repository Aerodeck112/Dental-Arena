import type { AppointmentStatus, Role } from "@/generated/prisma/enums";

/**
 * Appointment status rules (docs/architecture.md §3.2 invariant 2, §6.4). Pure and client-safe,
 * so the calendar and the Azi list can show only the actions that are allowed. The server
 * re-checks everything in `transitionAppointment` (status.ts), which re-exports these.
 */

/** Statuses that occupy the doctor, the cabinet and the sedation unit. ANULAT and NEPREZENTAT free the slot. */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT"];

export function isBlockingStatus(s: AppointmentStatus): boolean {
  return BLOCKING_STATUSES.includes(s);
}

/** §6.4 transition table (from → allowed targets). */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PROGRAMAT: ["CONFIRMAT", "SOSIT", "ANULAT", "NEPREZENTAT"],
  CONFIRMAT: ["PROGRAMAT", "SOSIT", "ANULAT", "NEPREZENTAT"],
  SOSIT: ["CONFIRMAT", "IN_TRATAMENT", "FINALIZAT", "ANULAT"],
  IN_TRATAMENT: ["SOSIT", "FINALIZAT"],
  FINALIZAT: ["IN_TRATAMENT"],
  ANULAT: ["PROGRAMAT"],
  NEPREZENTAT: ["PROGRAMAT", "SOSIT"],
};

/** Transitions that step back to the previous status („undo”); they clear the timestamp they revert. */
export const UNDO_TRANSITIONS: ReadonlyArray<readonly [AppointmentStatus, AppointmentStatus]> = [
  ["CONFIRMAT", "PROGRAMAT"],
  ["SOSIT", "CONFIRMAT"],
  ["IN_TRATAMENT", "SOSIT"],
  ["FINALIZAT", "IN_TRATAMENT"],
  ["ANULAT", "PROGRAMAT"],
  ["NEPREZENTAT", "PROGRAMAT"],
];

export function isUndo(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return UNDO_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/** NEPREZENTAT is allowed only once the appointment has started. */
export function requiresStarted(to: AppointmentStatus): boolean {
  return to === "NEPREZENTAT";
}

/** Undoing FINALIZAT is allowed for 24 hours after completion, ADMIN only. */
export const FINALIZAT_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * What a MEDIC may do on their own appointments (§5.2): move them through
 * SOSIT → IN_TRATAMENT → FINALIZAT (and step back), confirm them and cancel them. No-shows,
 * restores and undoing a completed visit stay with reception and the administrator.
 */
const MEDIC_TRANSITIONS: ReadonlyArray<readonly [AppointmentStatus, AppointmentStatus]> = [
  ["PROGRAMAT", "CONFIRMAT"],
  ["CONFIRMAT", "PROGRAMAT"],
  ["PROGRAMAT", "SOSIT"],
  ["CONFIRMAT", "SOSIT"],
  ["SOSIT", "CONFIRMAT"],
  ["SOSIT", "IN_TRATAMENT"],
  ["IN_TRATAMENT", "SOSIT"],
  ["SOSIT", "FINALIZAT"],
  ["IN_TRATAMENT", "FINALIZAT"],
  ["PROGRAMAT", "ANULAT"],
  ["CONFIRMAT", "ANULAT"],
  ["SOSIT", "ANULAT"],
];

/** What a patient may do through the `/p/[token]` link (§6.6). */
export const PATIENT_LINK_TRANSITIONS: ReadonlyArray<readonly [AppointmentStatus, AppointmentStatus]> = [
  ["PROGRAMAT", "CONFIRMAT"],
  ["PROGRAMAT", "ANULAT"],
  ["CONFIRMAT", "ANULAT"],
];

/**
 * True when `role` may move an appointment from `from` to `to`. Role-independent conditions that
 * need the appointment itself (NEPREZENTAT only after the start, restore only without a block
 * conflict, MEDIC only on own appointments) are checked by `transitionAppointment`.
 */
export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  role: Role,
  completedAt?: Date | null,
  now: Date = new Date(),
): boolean {
  if (from === to) return false;
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) return false;
  if (from === "FINALIZAT" && to === "IN_TRATAMENT") {
    if (role !== "ADMIN" || !completedAt) return false;
    const age = now.getTime() - completedAt.getTime();
    return age >= 0 && age <= FINALIZAT_UNDO_WINDOW_MS;
  }
  if (role === "MEDIC") return MEDIC_TRANSITIONS.some(([f, t]) => f === from && t === to);
  return role === "ADMIN" || role === "RECEPTIE";
}

/** The targets `role` may choose from `from` (for rendering the action buttons). */
export function allowedTargets(
  from: AppointmentStatus,
  role: Role,
  o: { completedAt?: Date | null; startsAt?: Date; now?: Date } = {},
): AppointmentStatus[] {
  const now = o.now ?? new Date();
  return (ALLOWED_TRANSITIONS[from] ?? []).filter((to) => {
    if (!canTransition(from, to, role, o.completedAt, now)) return false;
    if (requiresStarted(to) && o.startsAt && o.startsAt.getTime() > now.getTime()) return false;
    return true;
  });
}
