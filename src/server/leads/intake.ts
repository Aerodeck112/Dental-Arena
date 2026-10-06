import "server-only";
import { after } from "next/server";
import { audit } from "@/lib/audit";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { capitalize, formatDateRo, formatTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { utcToLocal } from "@/lib/time";
import { appointmentManageUrl } from "@/lib/tokens";
import { notifyClinicNewLead, sendAppointmentMessage } from "@/server/notify/send";
import { loadAvailability } from "@/server/scheduling/availability";
import { pickDoctor, shiftContaining } from "@/server/scheduling/compute";
import { findConflicts, withSchedulingTx } from "@/server/scheduling/conflicts";
import type { CallbackInput, ContactLeadInput, OnlineBookingInput } from "./schemas";

/**
 * Public lead intake (docs/architecture.md §6.5, §7.3): the contact form, online booking and
 * callback requests. Guards (honeypot, rate limits, zod) run in `publicAction` before these.
 * Clinic and patient notifications are scheduled with `after()`, so a slow SMTP server never
 * delays the visitor; a booking replayed through its idempotency key notifies no one again.
 */

export type BookingResult = {
  leadId: string;
  appointmentId: string;
  startsAtISO: string;
  localDateLabel: string;
  localTime: string;
  locationName: string;
  locationPhone: string;
  doctorName: string;
  manageUrl: string;
};

type IntakeMeta = { ipHash: string; sourcePath?: string };

/** Runs `task` after the response; outside a request scope (tests, scripts) it runs detached. */
function afterResponse(label: string, task: () => Promise<unknown>): void {
  const run = async () => {
    try {
      await task();
    } catch (e) {
      console.error(`[intake] ${label}: ${e instanceof Error ? e.name : typeof e}`);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

function slotTakenMessage(startsAt: Date): string {
  return `Ora de ${formatTime(startsAt)} tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.`;
}

function sourcePathOf(input: { sourcePath?: string }, meta: IntakeMeta): string | null {
  return input.sourcePath ?? meta.sourcePath ?? null;
}

async function bookingResult(appointmentId: string): Promise<BookingResult> {
  const a = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: {
      id: true,
      leadId: true,
      startsAt: true,
      tokenVersion: true,
      location: { select: { name: true, phone: true } },
      doctor: { select: { publicName: true } },
    },
  });
  return {
    leadId: a.leadId ?? "",
    appointmentId: a.id,
    startsAtISO: a.startsAt.toISOString(),
    localDateLabel: capitalize(formatDateRo(a.startsAt, "long")),
    localTime: formatTime(a.startsAt),
    locationName: a.location.name,
    locationPhone: a.location.phone,
    doctorName: a.doctor.publicName,
    manageUrl: appointmentManageUrl({ id: a.id, tokenVersion: a.tokenVersion, startsAt: a.startsAt }),
  };
}

/** The appointment created with an idempotency key, or null when the key is new. */
async function replayOf(db: Tx | typeof prisma, idempotencyKey: string): Promise<string | null> {
  const lead = await db.lead.findUnique({
    where: { idempotencyKey },
    select: { id: true, source: true, appointments: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!lead) return null;
  const appt = lead.appointments[0];
  if (lead.source !== "PROGRAMARE_ONLINE" || !appt) {
    throw new DomainError("CONFLICT", "Cererea a fost deja trimisă. Reîncărcați pagina pentru o programare nouă.");
  }
  return appt.id;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}

const LEAD_TIME_MESSAGE = "Ora aleasă este prea apropiată pentru o programare online. Alegeți o oră mai târzie sau sunați-ne.";

/**
 * Online booking (§6.5 submit): re-validates the service, doctor and slot rules, then inside
 * `withSchedulingTx` re-computes that the exact slot is still free (picking the doctor for
 * „Oricare medic” per §6.1 step 7), creates `Lead(PROGRAMARE_ONLINE, NOU)` and
 * `Appointment(PROGRAMAT, ONLINE, patientId null)`, a lead activity and the `booking.create`
 * audit row. A repeated `idempotencyKey` returns the first result. A taken slot raises
 * `SLOT_TAKEN` with „Ora de 10:30 tocmai a fost ocupată…”.
 */
export async function createOnlineBooking(
  i: OnlineBookingInput,
  meta: IntakeMeta & { now?: Date },
): Promise<BookingResult & { replayed: boolean }> {
  const now = meta.now ?? new Date();

  const replayId = await replayOf(prisma, i.idempotencyKey);
  if (replayId) return { ...(await bookingResult(replayId)), replayed: true };

  const [booking, gdpr] = await Promise.all([getSettings("booking"), getSettings("gdpr")]);
  if (!booking.onlineEnabled) {
    throw new DomainError("VALIDATION", "Programările online sunt oprite momentan. Sunați-ne și vă găsim o oră.");
  }
  const [service, location, doctor] = await Promise.all([
    prisma.service.findUnique({ where: { id: i.serviceId }, select: { id: true, active: true, bookableOnline: true, onlineLabel: true, name: true, durationMinutes: true } }),
    prisma.location.findUnique({ where: { id: i.locationId }, select: { id: true, active: true } }),
    i.doctorId
      ? prisma.doctor.findUnique({ where: { id: i.doctorId }, select: { id: true, active: true, acceptsOnlineBooking: true } })
      : Promise.resolve(null),
  ]);
  if (!service || !service.active || !service.bookableOnline) {
    throw new DomainError("VALIDATION", "Alegeți din nou motivul vizitei.", { fieldErrors: { serviceId: ["Alegeți din nou motivul vizitei."] } });
  }
  if (!location || !location.active) {
    throw new DomainError("VALIDATION", "Alegeți din nou clinica.", { fieldErrors: { locationId: ["Alegeți din nou clinica."] } });
  }
  if (i.doctorId && (!doctor || !doctor.active || !doctor.acceptsOnlineBooking)) {
    throw new DomainError("VALIDATION", "Medicul ales nu primește programări online. Alegeți „Oricare medic”.", {
      fieldErrors: { doctorId: ["Medicul ales nu primește programări online. Alegeți „Oricare medic”."] },
    });
  }
  const t = i.startsAt.getTime();
  if (t < now.getTime() + booking.minLeadMinutes * 60_000) {
    throw new DomainError("VALIDATION", LEAD_TIME_MESSAGE, { fieldErrors: { startsAt: [LEAD_TIME_MESSAGE] } });
  }
  if (t >= now.getTime() + booking.horizonDays * 86_400_000) {
    const m = `Programăm online cu cel mult ${booking.horizonDays} de zile înainte. Alegeți o zi mai apropiată sau sunați-ne.`;
    throw new DomainError("VALIDATION", m, { fieldErrors: { startsAt: [m] } });
  }

  const dateISO = utcToLocal(i.startsAt).dateISO;
  const startsAtISO = i.startsAt.toISOString();

  let created: { appointmentId: string; leadId: string; replayed: boolean; email: string | undefined };
  try {
    created = await withSchedulingTx(async (tx) => {
      const again = await replayOf(tx, i.idempotencyKey);
      if (again) return { appointmentId: again, leadId: "", replayed: true, email: undefined };

      const ctx = await loadAvailability(
        tx,
        { locationId: i.locationId, serviceId: i.serviceId, doctorId: i.doctorId ?? null, fromDateISO: dateISO, days: 1, channel: "online", now },
        booking,
      );
      const slot = ctx.days[0]?.slots.find((s) => s.startsAt === startsAtISO);
      if (!slot) throw new DomainError("SLOT_TAKEN", slotTakenMessage(i.startsAt));
      const doctorId = i.doctorId ?? pickDoctor(slot.doctorIds, dateISO, ctx.input.appointments, ctx.input.doctors);
      if (!doctorId || !slot.doctorIds.includes(doctorId)) throw new DomainError("SLOT_TAKEN", slotTakenMessage(i.startsAt));
      const endsAt = new Date(slot.endsAt);
      const cabinetId = shiftContaining(ctx.input.shifts, doctorId, i.locationId, i.startsAt, endsAt)?.cabinetId ?? null;

      const conflicts = await findConflicts(
        tx,
        { locationId: i.locationId, doctorId, cabinetId, startsAt: i.startsAt, endsAt, wantsSedation: i.wantsSedation },
        { now },
      );
      if (conflicts.some((c) => c.severity === "block")) throw new DomainError("SLOT_TAKEN", slotTakenMessage(i.startsAt));
      const sedationBusy = conflicts.find((c) => c.kind === "SEDATION_UNIT_BUSY");

      const forChild = i.forWhom === "copil";
      const lead = await tx.lead.create({
        data: {
          source: "PROGRAMARE_ONLINE",
          status: "NOU",
          name: i.name,
          phone: i.phone,
          email: i.email ?? null,
          message: i.note ?? null,
          locationId: i.locationId,
          serviceId: i.serviceId,
          preferredDoctorId: i.doctorId ?? null,
          comfort: i.comfort ?? null,
          comfortNote: i.comfortNote ?? null,
          wantsSedation: i.wantsSedation,
          forChild,
          childFirstName: forChild ? (i.childFirstName ?? null) : null,
          childAge: forChild ? (i.childAge ?? null) : null,
          consentGdprAt: now,
          consentTextVersion: gdpr.consentTextVersion,
          consentSms: i.consentSms,
          sourcePath: sourcePathOf(i, meta),
          ipHash: meta.ipHash,
          idempotencyKey: i.idempotencyKey,
        },
        select: { id: true },
      });
      const appointment = await tx.appointment.create({
        data: {
          locationId: i.locationId,
          doctorId,
          cabinetId,
          patientId: null,
          leadId: lead.id,
          serviceId: i.serviceId,
          reason: service.onlineLabel ?? service.name,
          startsAt: i.startsAt,
          endsAt,
          status: "PROGRAMAT",
          source: "ONLINE",
          comfort: i.comfort ?? null,
          comfortNote: i.comfortNote ?? null,
          wantsSedation: i.wantsSedation,
          notes: sedationBusy ? `Atenție: ${sedationBusy.message}` : null,
        },
        select: { id: true },
      });
      await tx.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", body: "Programare online creată" } });
      if (sedationBusy) {
        await tx.leadActivity.create({ data: { leadId: lead.id, type: "NOTA", body: sedationBusy.message } });
      }
      await audit(
        {
          action: "booking.create",
          entityType: "Appointment",
          entityId: appointment.id,
          metadata: { channel: "online", leadId: lead.id, ...(sedationBusy ? { warning: "SEDATION_UNIT_BUSY" } : {}) },
        },
        { actor: null, db: tx },
      );
      return { appointmentId: appointment.id, leadId: lead.id, replayed: false, email: i.email };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // A concurrent submit with the same key won: return its result.
      const id = await replayOf(prisma, i.idempotencyKey);
      if (id) return { ...(await bookingResult(id)), replayed: true };
    }
    if (e instanceof DomainError && e.code === "SLOT_TAKEN") {
      throw new DomainError("SLOT_TAKEN", slotTakenMessage(i.startsAt), { fieldErrors: { startsAt: [slotTakenMessage(i.startsAt)] } });
    }
    throw e;
  }

  const result = await bookingResult(created.appointmentId);
  if (!created.replayed) {
    const { appointmentId, leadId, email } = created;
    if (email) {
      afterResponse("confirmare", () => sendAppointmentMessage("CONFIRMARE_PROGRAMARE", appointmentId, { channels: ["EMAIL"] }));
    }
    afterResponse("notificare clinică", () => notifyClinicNewLead(leadId));
  }
  return { ...result, replayed: created.replayed };
}

async function existingIds(i: { locationId?: string; serviceId?: string; doctorId?: string }) {
  const [location, service, doctor] = await Promise.all([
    i.locationId ? prisma.location.findUnique({ where: { id: i.locationId }, select: { id: true } }) : null,
    i.serviceId ? prisma.service.findUnique({ where: { id: i.serviceId }, select: { id: true } }) : null,
    i.doctorId ? prisma.doctor.findUnique({ where: { id: i.doctorId }, select: { id: true } }) : null,
  ]);
  return { locationId: location?.id ?? null, serviceId: service?.id ?? null, doctorId: doctor?.id ?? null };
}

/**
 * „Prefer să mă sunați” (§6.5): `Lead { source: APEL_INVERS }` with the preferred time and the
 * wizard's clinic, reason and doctor, then a clinic notification. Idempotent by key.
 */
export async function createCallbackRequest(i: CallbackInput, meta: IntakeMeta): Promise<{ leadId: string }> {
  if (i.idempotencyKey) {
    const existing = await prisma.lead.findUnique({ where: { idempotencyKey: i.idempotencyKey }, select: { id: true } });
    if (existing) return { leadId: existing.id };
  }
  const gdpr = await getSettings("gdpr");
  const ids = await existingIds(i);
  let leadId: string;
  try {
    leadId = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          source: "APEL_INVERS",
          status: "NOU",
          name: i.name,
          phone: i.phone,
          preferredTime: i.preferredTime ?? null,
          locationId: ids.locationId,
          serviceId: ids.serviceId,
          preferredDoctorId: ids.doctorId,
          comfort: i.comfort ?? null,
          consentGdprAt: new Date(),
          consentTextVersion: gdpr.consentTextVersion,
          sourcePath: sourcePathOf(i, meta),
          ipHash: meta.ipHash,
          idempotencyKey: i.idempotencyKey ?? null,
        },
        select: { id: true },
      });
      await tx.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", body: "Cerere de apel din site" } });
      return lead.id;
    });
  } catch (e) {
    if (isUniqueViolation(e) && i.idempotencyKey) {
      const existing = await prisma.lead.findUnique({ where: { idempotencyKey: i.idempotencyKey }, select: { id: true } });
      if (existing) return { leadId: existing.id };
    }
    throw e;
  }
  afterResponse("notificare clinică", () => notifyClinicNewLead(leadId));
  return { leadId };
}

/**
 * The `/contact` form (WP3): `Lead { source: FORMULAR_CONTACT, message, consentGdprAt }`, then a
 * clinic notification. The page answers „Mesajul a fost trimis. Vă răspundem în cel mult o zi
 * lucrătoare.”
 */
export async function createContactLead(i: ContactLeadInput, meta: IntakeMeta): Promise<{ leadId: string }> {
  const gdpr = await getSettings("gdpr");
  const location = i.location ? await prisma.location.findUnique({ where: { slug: i.location }, select: { id: true } }) : null;
  const leadId = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        source: "FORMULAR_CONTACT",
        status: "NOU",
        name: i.name,
        email: i.email ?? null,
        phone: i.phone ?? null,
        message: i.message,
        locationId: location?.id ?? null,
        consentGdprAt: new Date(),
        consentTextVersion: gdpr.consentTextVersion,
        sourcePath: sourcePathOf(i, meta),
        ipHash: meta.ipHash,
      },
      select: { id: true },
    });
    await tx.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", body: "Mesaj din formularul de contact" } });
    return lead.id;
  });
  afterResponse("notificare clinică", () => notifyClinicNewLead(leadId));
  return { leadId };
}

/** Message shown after a contact lead is saved. */
export const CONTACT_SUCCESS_MESSAGE = "Mesajul a fost trimis. Vă răspundem în cel mult o zi lucrătoare.";
/** Message shown after a callback request (to be approved by the clinic). */
export const CALLBACK_SUCCESS_MESSAGE = "Vă sunăm noi în cel mult o zi lucrătoare.";

/** What the wizard receives after a booking (§6.5 step 6): no internal ids. */
export type PublicBookingResult = Omit<BookingResult, "leadId" | "appointmentId">;

export function toPublicBooking(r: BookingResult): PublicBookingResult {
  return {
    startsAtISO: r.startsAtISO,
    localDateLabel: r.localDateLabel,
    localTime: r.localTime,
    locationName: r.locationName,
    locationPhone: r.locationPhone,
    doctorName: r.doctorName,
    manageUrl: r.manageUrl,
  };
}

/**
 * The fake success a suspected bot receives (§8.2): shaped like a real result, built only from
 * what it sent, with no link. Nothing is written.
 */
export function botBookingResult(raw: Record<string, unknown>): PublicBookingResult {
  const value = typeof raw.startsAt === "string" ? new Date(raw.startsAt) : null;
  const startsAt = value && !Number.isNaN(value.getTime()) ? value : new Date();
  return {
    startsAtISO: startsAt.toISOString(),
    localDateLabel: capitalize(formatDateRo(startsAt, "long")),
    localTime: formatTime(startsAt),
    locationName: "Dental Arena",
    locationPhone: "",
    doctorName: "",
    manageUrl: "",
  };
}
