import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/BookingWizard";
import type { BookingState } from "@/components/booking/useBookingState";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import { prisma } from "@/lib/db";
import { formatPhone, formatTime, telHref } from "@/lib/format";
import { utcToLocal } from "@/lib/time";
import { comfortFromParam } from "@/server/leads/schemas";
import { getBookingOptions } from "@/server/scheduling/booking";
import type { BookingOptions } from "@/server/scheduling/types";

export const metadata: Metadata = {
  title: "Programare online",
  description:
    "Programați-vă online la Dental Arena Cristești, lângă Târgu Mureș, sau Luduș: alegeți motivul, clinica, ziua și ora. Vă sunăm ca să confirmăm.",
  alternates: { canonical: "/programare" },
};

/** Must match UNSURE_KEY in useBookingState (a client module: its values cannot be imported here). */
const UNSURE_KEY = "nu-stiu";

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

/**
 * Query-param prefill (§4.1): `?serviciu=<code>&clinica=cristesti|ludus&medic=<slug>&ora=<ISO>&confort=…`.
 * Unknown values are ignored; the wizard then opens at the first unanswered step. A service code
 * that is not itself a booking reason (a service page linking here) maps to the reason of its
 * category.
 */
async function prefill(sp: Record<string, string | string[] | undefined>, o: BookingOptions) {
  const serviciu = first(sp.serviciu);
  const clinica = first(sp.clinica);
  const medic = first(sp.medic);
  const ora = first(sp.ora);
  const confort = first(sp.confort);

  let reasonKey: string | null = null;
  if (serviciu === UNSURE_KEY && o.unsureServiceId) reasonKey = UNSURE_KEY;
  else if (serviciu) {
    const direct = o.reasons.find((r) => r.code?.toLowerCase() === serviciu.toLowerCase() || r.serviceId === serviciu);
    if (direct) reasonKey = direct.serviceId;
    else if (serviciu.length <= 40) {
      const svc = await prisma.service.findFirst({ where: { OR: [{ code: serviciu.toUpperCase() }, { id: serviciu }] }, select: { categoryId: true } });
      const sameCategory = svc ? o.reasons.find((r) => r.categoryId === svc.categoryId && !r.urgent) : undefined;
      reasonKey = sameCategory?.serviceId ?? null;
    }
  }

  const doctor = medic ? (o.doctors.find((d) => d.slug === medic || d.id === medic) ?? null) : null;
  let locationId = clinica ? (o.clinics.find((c) => c.slug === clinica || c.id === clinica)?.id ?? null) : null;
  // A doctor who works at one clinic only implies the clinic.
  if (!locationId && doctor && doctor.locationIds.length === 1) locationId = doctor.locationIds[0];

  let startsAt: string | null = null;
  let localTime: string | null = null;
  let dateISO: string | null = null;
  if (ora && reasonKey && locationId) {
    const t = new Date(ora);
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) {
      startsAt = t.toISOString();
      localTime = formatTime(t);
      dateISO = utcToLocal(t).dateISO;
    }
  }

  const comfort = comfortFromParam(confort);
  const state: BookingState = {
    reasonKey,
    locationId,
    doctorId: doctor && (!locationId || doctor.locationIds.includes(locationId)) ? doctor.id : null,
    dateISO,
    startsAt,
    localTime,
    comfort,
    wantsSedation: false,
    comfortNote: "",
    name: "",
    phone: "",
    email: "",
    forWhom: "eu",
    childFirstName: "",
    childAge: "",
    note: "",
    consentGdpr: false,
    consentSms: false,
  };
  return { state, prefilled: Boolean(serviciu || clinica || medic || ora || confort) };
}

/** `/programare`: the online booking wizard (docs/architecture.md §6.5, design system §6.7). */
export default async function BookingPage({ searchParams }: PageProps<"/programare">) {
  const [sp, options] = await Promise.all([searchParams, getBookingOptions()]);
  const { state, prefilled } = await prefill(sp, options);
  return (
    <>
      <noscript>
        <p className="mb-6 rounded-panou bg-menta-pal p-5 text-corp text-cerneala">
          Pentru programarea online este nevoie de JavaScript. Ne puteți suna la{" "}
          {options.clinics.map((c, i) => (
            <span key={c.id}>
              {i > 0 ? " sau la " : ""}
              {c.shortName}, <a href={telHref(c.phone)} className="telefon text-link underline">{formatPhone(c.phone)}</a>
            </span>
          ))}
          .
        </p>
      </noscript>
      <BookingWizard
        options={options}
        initial={state}
        prefilled={prefilled}
        idempotencyKey={randomUUID()}
        callbackKey={randomUUID()}
        honeypot={<HoneypotFields />}
        callbackHoneypot={<HoneypotFields />}
      />
    </>
  );
}
