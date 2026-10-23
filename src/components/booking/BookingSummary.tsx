"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { capitalize, formatDateRo, formatPhone, telHref } from "@/lib/format";
import { COMFORT_LABEL } from "@/lib/labels";
import type { BookingOptions } from "@/server/scheduling/types";
import { UNSURE_KEY, type BookingState } from "./useBookingState";

/** One summary row; it flashes `menta-pal` for 600ms when its value changes (design system §8). */
function Row({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState(0);
  if (value !== prev) {
    setPrev(value);
    setFlash((n) => n + 1);
  }
  return (
    <div key={flash} className={cn("-mx-2 rounded-control px-2 py-2", flash > 0 && "da-flash")}>
      <dt className="text-mic text-discret">{label}</dt>
      <dd className="text-corp text-cerneala">{children}</dd>
    </div>
  );
}

export function summaryParts(options: BookingOptions, s: BookingState) {
  const reason =
    s.reasonKey === UNSURE_KEY ? "Nu știu sigur" : (options.reasons.find((r) => r.serviceId === s.reasonKey)?.label ?? null);
  const clinic = options.clinics.find((c) => c.id === s.locationId) ?? null;
  const doctor = s.doctorId ? (options.doctors.find((d) => d.id === s.doctorId)?.publicName ?? null) : null;
  const when = s.startsAt ? `${capitalize(formatDateRo(new Date(s.startsAt), "long"))}, ${s.localTime ?? ""}` : null;
  return { reason, clinic, doctor, when };
}

/**
 * „Programarea”: what has been chosen so far, sticky beside the step on desktop and folded into a
 * one-line disclosure on phones. Ends with the phones for people who would rather call.
 */
export function BookingSummary({
  options,
  state,
  variant,
}: {
  options: BookingOptions;
  state: BookingState;
  variant: "aside" | "collapsed";
}) {
  const { reason, clinic, doctor, when } = summaryParts(options, state);
  const rows = (
    <dl className="flex flex-col">
      {reason && (
        <Row label="Motivul" value={reason}>
          {reason}
        </Row>
      )}
      {clinic && (
        <Row label="Clinica" value={clinic.id}>
          {clinic.name}
          <span className="block text-mic text-discret">
            {clinic.address}
            {clinic.addressNote ? `, ${clinic.addressNote}` : ""}
          </span>
        </Row>
      )}
      {(state.startsAt || state.doctorId) && (
        <Row label="Medicul" value={doctor ?? "oricare"}>
          {doctor ?? "Oricare medic"}
        </Row>
      )}
      {when && (
        <Row label="Ziua și ora" value={when}>
          <span className="cifre">{when}</span>
        </Row>
      )}
      {(state.comfort || state.wantsSedation) && (
        <Row label="Cum vă simțiți" value={`${state.comfort ?? ""}${state.wantsSedation}`}>
          {[state.comfort ? COMFORT_LABEL[state.comfort] : null, state.wantsSedation ? "cu inhalosedare" : null].filter(Boolean).join(", ")}
        </Row>
      )}
    </dl>
  );

  const phones = (
    <div className="flex flex-col gap-1 pt-4">
      <p className="text-mic font-semibold text-cerneala">Preferați la telefon?</p>
      <ul className="flex flex-col">
        {options.clinics.map((c) => (
          <li key={c.id}>
            <a
              href={telHref(c.phone)}
              aria-label={`Sunați la ${c.shortName}, ${formatPhone(c.phone)}`}
              className="inline-flex min-h-control items-center gap-2 text-mic text-cerneala underline decoration-linie-control underline-offset-[0.25em] hover:decoration-current"
            >
              <span>{c.shortName}</span>
              <span className="telefon">{formatPhone(c.phone)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  if (variant === "collapsed") {
    const line = [reason, clinic?.shortName, state.localTime].filter(Boolean).join(", ");
    if (!line) return null;
    return (
      <details className="group rounded-panou border border-linie bg-suprafata">
        <summary className="flex min-h-control items-center justify-between gap-3 px-4 text-control font-medium text-cerneala">
          <span className="truncate">{line}</span>
          <Icon name="chevron-down" size={20} className="shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="border-t border-linie px-4 pb-4">
          {rows}
          {phones}
        </div>
      </details>
    );
  }

  return (
    <aside aria-labelledby="sumar-titlu" className="rounded-panou border border-linie bg-suprafata p-5">
      <h2 id="sumar-titlu" className="text-h3 font-semibold text-cerneala">
        Programarea
      </h2>
      {reason || clinic ? <div className="mt-2">{rows}</div> : <p className="mt-2 text-mic text-discret">Alegerile dumneavoastră apar aici.</p>}
      <div className="mt-2 border-t border-linie">{phones}</div>
    </aside>
  );
}
