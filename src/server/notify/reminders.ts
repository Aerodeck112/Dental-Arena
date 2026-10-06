import "server-only";
import { prisma, type Db } from "@/lib/db";
import { getSettings, type SettingsMap } from "@/lib/settings";
import { utcToLocal } from "@/lib/time";
import { loadAppointmentForMessage, resolveContact, sendForAppointment } from "./send";
import type { MessageChannel, ReminderRunResult } from "./types";

/**
 * 24h reminders (docs/architecture.md §6.6). `/api/cron/reminders` runs `runReminders` hourly.
 * Idempotent: each appointment is claimed with a conditional update before anything is sent, so
 * concurrent or repeated runs never send twice.
 */

type ReminderSettings = SettingsMap["reminders"];

const HOUR_MS = 60 * 60 * 1000;
/** Appointments starting sooner than this get no reminder (reception calls them). */
const MIN_HOURS_AHEAD = 2;
/** Bookings made less than this before the visit get no reminder. */
const MIN_BOOKING_LEAD_HOURS = 6;
/** After this many `EROARE` logs for the same appointment, the job stops retrying. */
export const MAX_REMINDER_ERRORS = 3;

/** True inside the quiet window (local clinic time). The window may wrap past midnight. */
export function isQuietTime(now: Date, s: Pick<ReminderSettings, "quietStartMinute" | "quietEndMinute">): boolean {
  const { minute } = utcToLocal(now);
  const { quietStartMinute: start, quietEndMinute: end } = s;
  if (start === end) return false;
  return start > end ? minute >= start || minute < end : minute >= start && minute < end;
}

/**
 * Candidates (§6.6 step 3): PROGRAMAT or CONFIRMAT, no reminder yet, starting in more than 2 h and
 * at most `hoursBefore` h, booked at least 6 h before the visit. Ordered by start.
 */
export async function findReminderCandidates(
  now: Date,
  s: Pick<ReminderSettings, "hoursBefore">,
  db: Db = prisma,
): Promise<{ id: string; startsAt: Date }[]> {
  const rows = await db.appointment.findMany({
    where: {
      status: { in: ["PROGRAMAT", "CONFIRMAT"] },
      reminderSentAt: null,
      startsAt: { gt: new Date(now.getTime() + MIN_HOURS_AHEAD * HOUR_MS), lte: new Date(now.getTime() + s.hoursBefore * HOUR_MS) },
    },
    select: { id: true, startsAt: true, createdAt: true },
    orderBy: { startsAt: "asc" },
  });
  return rows
    .filter((r) => r.createdAt.getTime() <= r.startsAt.getTime() - MIN_BOOKING_LEAD_HOURS * HOUR_MS)
    .map(({ id, startsAt }) => ({ id, startsAt }));
}

/** Runs the reminder job at `now`. Settings default to `settings.reminders`. */
export async function runReminders(
  now: Date = new Date(),
  o: { settings?: ReminderSettings; db?: Db } = {},
): Promise<ReminderRunResult> {
  const db = o.db ?? prisma;
  const s = o.settings ?? (await getSettings("reminders"));
  const nowISO = now.toISOString();
  if (!s.enabled) return { skipped: "disabled", now: nowISO };
  if (isQuietTime(now, s)) return { skipped: "quiet-hours", now: nowISO };

  const channels: MessageChannel[] = [];
  if (s.smsEnabled) channels.push("SMS");
  if (s.emailEnabled) channels.push("EMAIL");

  const candidates = await findReminderCandidates(now, s, db);
  const result = { now: nowISO, considered: candidates.length, sent: { sms: 0, email: 0 }, failed: 0, skipped: 0 };

  for (const c of candidates) {
    // 1. Claim: only one run wins the conditional update.
    const claim = await db.appointment.updateMany({ where: { id: c.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claim.count !== 1) {
      result.skipped += 1;
      continue;
    }

    const release = () => db.appointment.updateMany({ where: { id: c.id, reminderSentAt: now }, data: { reminderSentAt: null } });

    // 2. Resolve the contact and the usable channels.
    const a = await loadAppointmentForMessage(c.id, db);
    const contact = a ? resolveContact(a) : null;
    if (!a || !contact || contact.anonymized) {
      result.skipped += 1;
      continue;
    }
    const usable = channels.filter((ch) => (ch === "SMS" ? Boolean(contact.phone && contact.smsConsent) : Boolean(contact.email)));
    if (usable.length === 0) {
      // Nothing to send now; release the claim so a contact added later still gets a reminder.
      await release();
      result.skipped += 1;
      continue;
    }

    // 3–5. Render, send and log.
    let outcomes;
    try {
      outcomes = await sendForAppointment("REMINDER", a, usable, { stripDiacritics: s.smsStripDiacritics, db });
    } catch (e) {
      console.error(`[reminders] eroare la programarea ${c.id}: ${e instanceof Error ? e.name : typeof e}`);
      outcomes = [];
    }
    const ok = outcomes.filter((x) => x.status !== "EROARE");
    for (const x of ok) {
      if (x.channel === "SMS") result.sent.sms += 1;
      else result.sent.email += 1;
    }
    if (outcomes.length === 0) {
      // Templates switched off or rendering failed: nothing went out.
      await release();
      result.skipped += 1;
      continue;
    }
    if (ok.length === 0) {
      // 6. Every channel failed: retry next run, unless the error budget is spent.
      result.failed += 1;
      const errors = await db.messageLog.count({ where: { appointmentId: c.id, kind: "REMINDER", status: "EROARE" } });
      if (errors < MAX_REMINDER_ERRORS) await release();
    }
  }
  return result;
}
