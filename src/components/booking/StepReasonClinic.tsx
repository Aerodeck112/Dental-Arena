"use client";

import { ChoiceButton } from "@/components/ui/ChoiceButton";
import { ChoicePanel } from "@/components/ui/ChoicePanel";
import { Icon } from "@/components/ui/Icon";
import { formatDateRo, formatPhone, telHref } from "@/lib/format";
import type { BookingOptions } from "@/server/scheduling/types";
import { UNSURE_KEY, type BookingState } from "./useBookingState";

/** „mar. 7 oct., 09:30” */
export function shortSlotLabel(dateISO: string, localTime: string): string {
  return `${formatDateRo(dateISO, "weekday")}, ${localTime}`;
}

/** „Sunați-ne și găsim cea mai apropiată oră.” with both clinic phones (the „Am o durere acum” branch). */
export function UrgentPhones({ clinics }: { clinics: BookingOptions["clinics"] }) {
  return (
    <div role="note" className="rounded-panou bg-menta-pal p-5">
      <p className="text-h3 font-semibold text-cerneala">Sunați-ne și găsim cea mai apropiată oră.</p>
      <p className="mt-1 text-corp text-discret masura">Dacă durerea nu vă lasă să așteptați, telefonul este cel mai rapid. Puteți totuși alege mai jos o oră liberă.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {clinics.map((c) => (
          <li key={c.id}>
            <a
              href={telHref(c.phone)}
              aria-label={`Sunați la ${c.shortName}, ${formatPhone(c.phone)}`}
              className="apasat flex min-h-control-l items-center justify-between gap-3 rounded-control border border-cerneala bg-suprafata px-4 text-control font-semibold text-cerneala hover:bg-fundal"
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="phone" size={20} />
                {c.shortName}
              </span>
              <span className="telefon">{formatPhone(c.phone)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Step 1 „Motivul și clinica”: the reason for the visit, then the clinic (two panels split on the axis). */
export function StepReasonClinic({
  options,
  state,
  onReason,
  onClinic,
  errors,
}: {
  options: BookingOptions;
  state: BookingState;
  onReason: (key: string) => void;
  onClinic: (locationId: string) => void;
  errors: { reason?: string; clinic?: string };
}) {
  const urgent = options.reasons.some((r) => r.serviceId === state.reasonKey && r.urgent);
  const reasons = [
    ...options.reasons.map((r) => ({ key: r.serviceId, label: r.label, hint: r.hint })),
    ...(options.unsureServiceId ? [{ key: UNSURE_KEY, label: "Nu știu sigur", hint: null }] : []),
  ];

  return (
    <div className="flex flex-col gap-10">
      {urgent && <UrgentPhones clinics={options.clinics} />}

      <section aria-labelledby="pas1-motiv" className="flex flex-col gap-4">
        <h2 id="pas1-motiv" className="font-display text-h2 text-cerneala">
          Cu ce vă putem ajuta?
        </h2>
        {errors.reason && (
          <p id="field-reasonKey" tabIndex={-1} className="text-mic font-medium text-carmin">
            {errors.reason}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby="pas1-motiv">
          {reasons.map((r) => (
            <ChoiceButton
              key={r.key}
              selected={state.reasonKey === r.key}
              description={r.hint ?? undefined}
              onClick={() => onReason(r.key)}
              className="w-full"
            >
              {r.label}
            </ChoiceButton>
          ))}
        </div>
      </section>

      <section aria-labelledby="pas1-clinica" className="flex flex-col gap-4">
        <h2 id="pas1-clinica" className="font-display text-h2 text-cerneala">
          La ce clinică veniți?
        </h2>
        {errors.clinic && (
          <p id="field-locationId" tabIndex={-1} className="text-mic font-medium text-carmin">
            {errors.clinic}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby="pas1-clinica">
          {options.clinics.map((c) => (
            <ChoicePanel key={c.id} title={c.shortName} selected={state.locationId === c.id} onClick={() => onClinic(c.id)} className="h-full">
              <span>
                {c.address}
                {c.addressNote ? `, ${c.addressNote}` : ""}
              </span>
              <span className="cifre text-cerneala">
                {c.nextSlot ? `Prima oră liberă: ${shortSlotLabel(c.nextSlot.dateISO, c.nextSlot.localTime)}` : "Pentru o oră liberă, sunați-ne."}
              </span>
            </ChoicePanel>
          ))}
        </div>
      </section>
    </div>
  );
}
