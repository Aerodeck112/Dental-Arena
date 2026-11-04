import "server-only";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { capitalize, formatDateRo, formatPhone, formatTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { verifyAppointmentToken } from "@/lib/tokens";
import { mapsSearchUrl } from "./booking";
import { buildIcs } from "./ics";
import { transitionAppointment } from "./status";

/**
 * Patient self-service through the signed link `/p/[token]` (docs/architecture.md §6.6).
 * Reading never mutates (SMS and e-mail apps prefetch links). The DTO carries the patient's
 * first name only, and no service or health details.
 */

export type ManagedAppointment = {
  firstName: string;
  startsAtISO: string;
  endsAtISO: string;
  dateLabel: string;
  time: string;
  locationName: string;
  locationShortName: string;
  address: string;
  mapsUrl: string | null;
  phone: string;
  doctorName: string;
  status: "PROGRAMAT" | "CONFIRMAT" | "OTHER";
  canConfirm: boolean;
  canCancel: boolean;
  /** Cancelling online is closed (cutoff passed); the page shows the clinic phone instead. */
  cancelClosed: boolean;
  cancelCutoffHours: number;
};

export type LinkView = { ok: true; appointment: ManagedAppointment } | { ok: false; message: string };

/** „Linkul nu mai este valabil. Pentru modificări sunați la Cristești, 0265 326 316 sau Luduș, 0365 430 125.” */
export async function invalidLinkMessage(): Promise<string> {
  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { shortName: true, phone: true },
  });
  const phones = locations.map((l) => `${l.shortName}, ${formatPhone(l.phone)}`);
  const list = phones.length > 1 ? `${phones.slice(0, -1).join(", ")} sau ${phones[phones.length - 1]}` : (phones[0] ?? "");
  return list ? `Linkul nu mai este valabil. Pentru modificări sunați la ${list}.` : "Linkul nu mai este valabil.";
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

const select = {
  id: true,
  status: true,
  startsAt: true,
  endsAt: true,
  tokenVersion: true,
  leadId: true,
  patient: { select: { firstName: true } },
  lead: { select: { name: true } },
  doctor: { select: { publicName: true } },
  location: { select: { name: true, shortName: true, street: true, city: true, county: true, phone: true } },
} as const;

async function loadByToken(token: string, now: Date) {
  const claims = verifyAppointmentToken(token, now);
  if (!claims) return null;
  const appt = await prisma.appointment.findUnique({ where: { id: claims.appointmentId }, select });
  if (!appt || appt.tokenVersion !== claims.tokenVersion) return null;
  return appt;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadByToken>>>;

function toView(a: Loaded, now: Date, cutoffHours: number): ManagedAppointment {
  const open = a.status === "PROGRAMAT" || a.status === "CONFIRMAT";
  const beforeCutoff = now.getTime() < a.startsAt.getTime() - cutoffHours * 3_600_000;
  const l = a.location;
  return {
    firstName: a.patient?.firstName ?? firstNameOf(a.lead?.name ?? ""),
    startsAtISO: a.startsAt.toISOString(),
    endsAtISO: a.endsAt.toISOString(),
    dateLabel: capitalize(formatDateRo(a.startsAt, "long")),
    time: formatTime(a.startsAt),
    locationName: l.name,
    locationShortName: l.shortName,
    address: [l.street, l.city, l.county].filter(Boolean).join(", "),
    mapsUrl: mapsSearchUrl(l),
    phone: l.phone,
    doctorName: a.doctor.publicName,
    status: a.status === "PROGRAMAT" || a.status === "CONFIRMAT" ? a.status : "OTHER",
    canConfirm: a.status === "PROGRAMAT" && now.getTime() < a.startsAt.getTime(),
    canCancel: open && beforeCutoff,
    cancelClosed: open && !beforeCutoff,
    cancelCutoffHours: cutoffHours,
  };
}

/** What `/p/[token]` shows. Tampered, expired and stale-version tokens give the invalid-link message. */
export async function getManagedAppointment(token: string, now: Date = new Date()): Promise<LinkView> {
  const appt = await loadByToken(token, now);
  if (!appt) return { ok: false, message: await invalidLinkMessage() };
  const { cancelCutoffHours } = await getSettings("booking");
  return { ok: true, appointment: toView(appt, now, cancelCutoffHours) };
}

async function requireByToken(token: string, now: Date): Promise<Loaded> {
  const appt = await loadByToken(token, now);
  if (!appt) throw new DomainError("NOT_FOUND", await invalidLinkMessage());
  return appt;
}

/**
 * „Confirm programarea”: PROGRAMAT → CONFIRMAT with `confirmedVia = LINK`, audited with no actor
 * (`via: "link"`), plus a lead activity. Confirming twice is harmless.
 */
export async function confirmByToken(token: string, now: Date = new Date()): Promise<ManagedAppointment> {
  const appt = await requireByToken(token, now);
  const { cancelCutoffHours } = await getSettings("booking");
  if (appt.status === "CONFIRMAT") return toView(appt, now, cancelCutoffHours);
  if (appt.status !== "PROGRAMAT" || now.getTime() >= appt.startsAt.getTime()) {
    throw new DomainError("INVALID_TRANSITION", `Programarea nu mai poate fi confirmată online. Sunați la ${appt.location.shortName}, ${formatPhone(appt.location.phone)}.`);
  }
  await transitionAppointment(appt.id, "CONFIRMAT", { actor: null, via: "LINK", now });
  if (appt.leadId) {
    await prisma.leadActivity.create({ data: { leadId: appt.leadId, type: "STATUS", body: "Pacientul a confirmat programarea din link" } });
  }
  const fresh = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id }, select });
  return toView(fresh, now, cancelCutoffHours);
}

/**
 * „Anulez programarea”: allowed while `now < startsAt − cancelCutoffHours` and the status is
 * PROGRAMAT or CONFIRMAT. ANULAT with `cancelledBy = PACIENT`; `tokenVersion++` invalidates the
 * link. Past the cutoff it raises an error naming the clinic phone. The caller notifies the clinic.
 */
export async function cancelByToken(
  token: string,
  now: Date = new Date(),
): Promise<{ appointmentId: string; appointment: ManagedAppointment }> {
  const appt = await requireByToken(token, now);
  const { cancelCutoffHours } = await getSettings("booking");
  const view = toView(appt, now, cancelCutoffHours);
  const phone = `${appt.location.shortName}, ${formatPhone(appt.location.phone)}`;
  if (!view.canCancel) {
    throw new DomainError(
      "INVALID_TRANSITION",
      view.cancelClosed
        ? `Cu mai puțin de ${cancelCutoffHours} ${cancelCutoffHours === 1 ? "oră" : "ore"} înainte, anularea se face doar la telefon: ${phone}.`
        : `Programarea nu mai poate fi anulată online. Sunați la ${phone}.`,
    );
  }
  await transitionAppointment(appt.id, "ANULAT", { actor: null, cancelledBy: "PACIENT", reason: "Anulată de pacient din link", now });
  if (appt.leadId) {
    await prisma.leadActivity.create({ data: { leadId: appt.leadId, type: "STATUS", body: "Pacientul a anulat programarea din link" } });
  }
  return { appointmentId: appt.id, appointment: { ...view, status: "OTHER", canConfirm: false, canCancel: false, cancelClosed: false } };
}

/** The `.ics` file of a linked appointment, or null for an invalid link. */
export async function icsForToken(token: string, now: Date = new Date()): Promise<{ filename: string; body: string } | null> {
  const appt = await loadByToken(token, now);
  if (!appt) return null;
  const l = appt.location;
  const body = buildIcs({
    uid: `${appt.id}@dentalarena.ro`,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    stamp: now,
    summary: `Programare la ${l.name}`,
    location: [l.name, l.street, l.city, l.county].filter(Boolean).join(", "),
    description: [`Medic: ${appt.doctor.publicName}`, `Telefon ${l.shortName}: ${formatPhone(l.phone)}`].join("\n"),
    status: appt.status === "ANULAT" ? "CANCELLED" : appt.status === "PROGRAMAT" ? "TENTATIVE" : "CONFIRMED",
    sequence: appt.tokenVersion,
    alarmMinutesBefore: 120,
  });
  const day = appt.startsAt.toISOString().slice(0, 10);
  return { filename: `programare-dental-arena-${day}.ics`, body };
}
