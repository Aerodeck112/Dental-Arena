import "server-only";
import { can } from "@/lib/permissions";
import { prisma, Prisma, type Db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { minutesToHHMM, utcToLocal, localToUtc } from "@/lib/time";
import type { Role } from "@/generated/prisma/enums";
import { BLOCKING_STATUSES } from "./rules";
import { interval, MINUTE_MS, overlaps, type Interval } from "./intervals";
import type { AppointmentCandidate, Conflict, ConflictKind } from "./types";

/**
 * Conflict detection and race safety (docs/architecture.md §6.2, §6.3).
 *
 * `findConflicts` reports every problem with a candidate interval; `assertConflictsAllowed`
 * applies the block/warn rules for a user; `withSchedulingTx` runs an appointment write in a
 * Serializable transaction and retries write conflicts (P2034) before raising `SLOT_TAKEN`.
 */

export const CONFLICT_SEVERITY: Record<ConflictKind, "block" | "warn"> = {
  DOCTOR_OVERLAP: "block",
  CABINET_OVERLAP: "block",
  TIME_OFF: "block",
  OUTSIDE_SHIFT: "warn",
  ON_BREAK: "warn",
  PATIENT_OVERLAP: "warn",
  SEDATION_UNIT_BUSY: "warn",
  IN_PAST: "warn",
};

/** Warnings a MEDIC may override, and only on their own appointments (§6.2). */
export const MEDIC_OVERRIDABLE: readonly ConflictKind[] = ["OUTSIDE_SHIFT", "IN_PAST"];

const GRID_MINUTES = 5;
const MIN_DURATION = 5;
const MAX_DURATION = 480;

/** „Dr. Mașca”. */
export function doctorShortName(d: { honorific?: string | null; lastName: string }): string {
  return `${d.honorific?.trim() || "Dr."} ${d.lastName}`;
}

/** „Cabinet 2” → „Cabinetul 2”. */
export function cabinetArticled(name: string): string {
  return /^cabinet\b/i.test(name) ? name.replace(/^cabinet\b/i, "Cabinetul") : name;
}

function hhmm(d: Date): string {
  return minutesToHHMM(utcToLocal(d).minute);
}

/**
 * §3.2 invariant 1: `startsAt < endsAt`, both on the 5-minute grid, the same local calendar day,
 * duration 5–480 minutes. Throws `VALIDATION` with a field error on `startsAt`.
 */
export function assertValidInterval(startsAt: Date, endsAt: Date): void {
  const problem = intervalProblem(startsAt, endsAt);
  if (problem) throw new DomainError("VALIDATION", problem, { fieldErrors: { startsAt: [problem] } });
}

/** The Romanian reason an interval breaks invariant 1, or null when it is valid. */
export function intervalProblem(startsAt: Date, endsAt: Date): string | null {
  const s = startsAt.getTime();
  const e = endsAt.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return "Alegeți data și ora programării.";
  if (!(s < e)) return "Ora de sfârșit trebuie să fie după ora de început.";
  const a = utcToLocal(startsAt);
  const b = utcToLocal(new Date(e - 1));
  if (a.dateISO !== b.dateISO) return "Programarea trebuie să înceapă și să se termine în aceeași zi.";
  if (s % (GRID_MINUTES * MINUTE_MS) !== 0 || e % (GRID_MINUTES * MINUTE_MS) !== 0) {
    return "Alegeți ore din 5 în 5 minute, de exemplu 10:30 sau 10:35.";
  }
  const minutes = (e - s) / MINUTE_MS;
  if (minutes < MIN_DURATION || minutes > MAX_DURATION) return "Durata trebuie să fie între 5 minute și 8 ore.";
  return null;
}

function conflict(kind: ConflictKind, message: string, appointmentId?: string): Conflict {
  return appointmentId
    ? { kind, severity: CONFLICT_SEVERITY[kind], message, appointmentId }
    : { kind, severity: CONFLICT_SEVERITY[kind], message };
}

/** Largest number of intervals in `list` that overlap at one instant inside `window`. */
export function maxConcurrent(list: readonly Interval[], window: Interval): number {
  const events: [number, number][] = [];
  for (const i of list) {
    const start = Math.max(i.start, window.start);
    const end = Math.min(i.end, window.end);
    if (start < end) events.push([start, 1], [end, -1]);
  }
  // Ends before starts at the same instant: touching intervals do not overlap.
  events.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let current = 0;
  let max = 0;
  for (const [, delta] of events) {
    current += delta;
    if (current > max) max = current;
  }
  return max;
}

const TIME_OFF_PHRASE: Record<string, string> = {
  CONCEDIU: "este în concediu",
  FORMARE: "este la un curs de formare",
  BLOCAJ: "nu este disponibil",
  SARBATOARE: "nu lucrează (sărbătoare legală)",
};

/**
 * Every conflict of `c` (§6.2). Reads through `db`, so it can run inside the caller's transaction
 * (it must, for writes: see `withSchedulingTx`). `excludeAppointmentId` is `c.appointmentId`.
 */
export async function findConflicts(db: Db, c: AppointmentCandidate, opts: { now?: Date } = {}): Promise<Conflict[]> {
  const now = opts.now ?? new Date();
  const out: Conflict[] = [];
  const range = interval(c.startsAt, c.endsAt);
  const notThis = c.appointmentId ? { id: { not: c.appointmentId } } : {};
  const overlapping = { startsAt: { lt: c.endsAt }, endsAt: { gt: c.startsAt } };
  const blocking = { status: { in: [...BLOCKING_STATUSES] } };
  const local = utcToLocal(c.startsAt);

  const [doctor, location, cabinet, doctorAppts, cabinetAppts, timeOff, shifts] = await Promise.all([
    db.doctor.findUnique({ where: { id: c.doctorId }, select: { honorific: true, lastName: true } }),
    db.location.findUnique({ where: { id: c.locationId }, select: { shortName: true, sedationUnits: true } }),
    c.cabinetId ? db.cabinet.findUnique({ where: { id: c.cabinetId }, select: { name: true } }) : Promise.resolve(null),
    db.appointment.findMany({
      where: { doctorId: c.doctorId, ...blocking, ...overlapping, ...notThis },
      select: { id: true, startsAt: true },
      orderBy: { startsAt: "asc" },
    }),
    c.cabinetId
      ? db.appointment.findMany({
          where: { cabinetId: c.cabinetId, doctorId: { not: c.doctorId }, ...blocking, ...overlapping, ...notThis },
          select: { id: true, startsAt: true },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([] as { id: string; startsAt: Date }[]),
    db.timeOff.findMany({
      where: {
        startsAt: { lt: c.endsAt },
        endsAt: { gt: c.startsAt },
        OR: [
          { doctorId: c.doctorId, OR: [{ locationId: null }, { locationId: c.locationId }] },
          { doctorId: null, locationId: c.locationId },
        ],
      },
      select: { doctorId: true, kind: true, reason: true },
    }),
    db.workShift.findMany({
      where: { doctorId: c.doctorId, locationId: c.locationId, weekday: local.weekday },
      select: {
        startMinute: true,
        endMinute: true,
        validFrom: true,
        validUntil: true,
        breaks: { select: { startMinute: true, endMinute: true } },
      },
    }),
  ]);

  const drName = doctor ? doctorShortName(doctor) : "Medicul";

  for (const a of doctorAppts) {
    out.push(conflict("DOCTOR_OVERLAP", `${drName} are deja o programare la ${hhmm(a.startsAt)}. Alegeți altă oră sau alt medic.`, a.id));
  }
  for (const a of cabinetAppts) {
    const cab = cabinet ? cabinetArticled(cabinet.name) : "Cabinetul";
    out.push(conflict("CABINET_OVERLAP", `${cab} este ocupat la ${hhmm(a.startsAt)}. Alegeți alt cabinet sau altă oră.`, a.id));
  }
  for (const t of timeOff) {
    if (t.doctorId) {
      out.push(conflict("TIME_OFF", `${drName} ${TIME_OFF_PHRASE[t.kind] ?? "nu este disponibil"} în această zi. Alegeți altă zi sau alt medic.`));
    } else {
      const place = location ? `Clinica din ${location.shortName}` : "Clinica";
      const why = t.reason ? ` (${t.reason})` : "";
      out.push(conflict("TIME_OFF", `${place} este închisă în această zi${why}. Alegeți altă zi.`));
    }
  }

  // Shift and breaks on the local day of the start (an appointment never spans two days).
  const day = local.dateISO;
  const dayStart = localToUtc(day, 0);
  const valid = shifts.filter(
    (s) => (!s.validFrom || s.validFrom.getTime() <= dayStart.getTime()) && (!s.validUntil || s.validUntil.getTime() > dayStart.getTime()),
  );
  const containing = valid.filter((s) => {
    if (s.endMinute <= s.startMinute) return false;
    return localToUtc(day, s.startMinute) <= c.startsAt && c.endsAt <= localToUtc(day, s.endMinute);
  });
  if (containing.length === 0) {
    const place = location ? ` la ${location.shortName}` : "";
    out.push(conflict("OUTSIDE_SHIFT", `${drName} nu are program${place} la această oră.`));
  } else {
    const onBreak = containing
      .flatMap((s) => s.breaks)
      .find((b) => b.endMinute > b.startMinute && overlaps(range, interval(localToUtc(day, b.startMinute), localToUtc(day, b.endMinute))));
    if (onBreak) {
      out.push(
        conflict("ON_BREAK", `Ora se suprapune cu pauza ${drName} (${minutesToHHMM(onBreak.startMinute)}–${minutesToHHMM(onBreak.endMinute)}).`),
      );
    }
  }

  if (c.patientId) {
    const patientAppts = await db.appointment.findMany({
      where: { patientId: c.patientId, ...blocking, ...overlapping, ...notThis },
      select: { id: true, startsAt: true, doctor: { select: { honorific: true, lastName: true } } },
      orderBy: { startsAt: "asc" },
    });
    for (const a of patientAppts) {
      out.push(
        conflict("PATIENT_OVERLAP", `Pacientul are deja o programare la ${hhmm(a.startsAt)}, la ${doctorShortName(a.doctor)}.`, a.id),
      );
    }
  }

  if (c.wantsSedation && location) {
    const sedated = await db.appointment.findMany({
      where: { locationId: c.locationId, wantsSedation: true, ...blocking, ...overlapping, ...notThis },
      select: { startsAt: true, endsAt: true },
    });
    const busy = maxConcurrent(
      sedated.map((a) => interval(a.startsAt, a.endsAt)),
      range,
    );
    if (busy >= Math.max(0, location.sedationUnits)) {
      out.push(
        conflict(
          "SEDATION_UNIT_BUSY",
          location.sedationUnits > 1
            ? "Toate aparatele de inhalosedare sunt rezervate la această oră. Stabiliți ora sedării cu pacientul."
            : "Aparatul de inhalosedare este deja rezervat la această oră. Stabiliți ora sedării cu pacientul.",
        ),
      );
    }
  }

  if (c.startsAt.getTime() < now.getTime()) {
    out.push(conflict("IN_PAST", "Ora de început este în trecut. Salvați doar dacă înregistrați o vizită care a avut loc."));
  }

  return out;
}

/**
 * Applies the §6.2 rules: a `block` always rejects; a `warn` rejects unless the request carries
 * `acknowledgeWarnings` and the user may override it (A/R: every warning; MEDIC: only
 * OUTSIDE_SHIFT and IN_PAST on their own appointments). Throws `CONFLICT` with the conflicts in
 * `details`, so the form can list them.
 */
export function assertConflictsAllowed(
  conflicts: readonly Conflict[],
  opts: { acknowledgeWarnings?: boolean; user: { role: Role; doctorId: string | null } | null; doctorId: string },
): void {
  const blocks = conflicts.filter((c) => c.severity === "block");
  if (blocks.length > 0) {
    throw new DomainError("CONFLICT", blocks[0].message, { details: { conflicts: [...conflicts] } });
  }
  const warns = conflicts.filter((c) => c.severity === "warn");
  if (warns.length === 0) return;
  const user = opts.user;
  const overridable = (c: Conflict) => {
    if (!user) return false;
    if (can(user, "appointments.override")) return true;
    return user.role === "MEDIC" && user.doctorId === opts.doctorId && MEDIC_OVERRIDABLE.includes(c.kind);
  };
  if (!opts.acknowledgeWarnings || !warns.every(overridable)) {
    const first = warns.find((c) => !overridable(c)) ?? warns[0];
    throw new DomainError("CONFLICT", first.message, { details: { conflicts: [...conflicts] } });
  }
}

function errorCode(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
}

/** PostgreSQL serialisation failure (P2034): another transaction wrote the same rows first. */
function isSerializationFailure(e: unknown): boolean {
  const message = e instanceof Error ? e.message : "";
  return errorCode(e) === "P2034" || /could not serialize|deadlock/i.test(message);
}

/**
 * SQLite's equivalent: a second writer cannot upgrade its lock (SQLITE_BUSY, which the
 * better-sqlite3 adapter reports as a timeout, P1008). Within one server process the adapter
 * serialises transactions; this happens only with several processes on one file.
 */
function isBusy(e: unknown): boolean {
  const message = e instanceof Error ? e.message : "";
  return errorCode(e) === "P1008" || /SQLITE_BUSY|database is locked|Operation has timed out/i.test(message);
}

const MAX_ATTEMPTS = 3;
/** A busy SQLite file frees up within milliseconds; waiting a little longer costs nothing. */
const MAX_BUSY_ATTEMPTS = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs an appointment write in a Serializable transaction (§6.3). The callback must re-check
 * conflicts with `findConflicts(tx, …)` inside the transaction. On a write conflict (Prisma
 * P2034 on PostgreSQL, a busy database on SQLite) it retries up to 3 times with jitter; a
 * serialisation failure that persists raises `SLOT_TAKEN`. Domain errors thrown by the callback propagate unchanged.
 */
export async function withSchedulingTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (e) {
      const serialization = isSerializationFailure(e);
      if (!serialization && !isBusy(e)) throw e;
      // A lost serialisation race means someone else took the slot; a busy database is not that.
      if (serialization && attempt >= MAX_ATTEMPTS) throw new DomainError("SLOT_TAKEN");
      if (!serialization && attempt >= MAX_BUSY_ATTEMPTS) throw e;
      await sleep(20 + Math.floor(Math.random() * 40) * attempt);
    }
  }
}
