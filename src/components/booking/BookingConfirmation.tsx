"use client";

import { useEffect, useRef } from "react";
import { ThreadGlyph } from "@/components/brand/ThreadGlyph";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { formatPhone } from "@/lib/format";
import type { ComfortValue } from "@/server/leads/schemas";
import type { BookingClinic } from "@/server/scheduling/types";
import { STEP_COUNT } from "./useBookingState";

export type ConfirmationData = {
  localDateLabel: string;
  localTime: string;
  locationName: string;
  locationPhone: string;
  doctorName: string;
  manageUrl: string;
};

/**
 * The confirmation (design system §6.7, §8): centred on the axis, the crown draws onto the filled
 * screw, then the text arrives. Offers the `.ics` file, the map and the practical list.
 */
export function BookingConfirmation({
  data,
  clinic,
  comfort,
  wantsSedation,
  onNewBooking,
}: {
  data: ConfirmationData;
  clinic: BookingClinic | null;
  comfort: ComfortValue | null;
  wantsSedation: boolean;
  onNewBooking: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const phone = data.locationPhone || clinic?.phone || "";
  const address = clinic ? `${clinic.address}${clinic.addressNote ? `, ${clinic.addressNote}` : ""}` : "";

  return (
    <section aria-labelledby="confirmare-titlu" className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center">
      <ThreadGlyph count={STEP_COUNT} current={STEP_COUNT} crown crownAnimated className="h-40 w-auto" />
      <div className="da-crown-text flex flex-col items-center gap-4">
        <h1 id="confirmare-titlu" ref={headingRef} tabIndex={-1} className="font-display text-h1 text-cerneala outline-none">
          Ora de {data.localTime} este rezervată.
        </h1>
        <p className="text-lead text-cerneala masura-lead">
          {data.localDateLabel}, {data.locationName}
          {address ? `, ${address}` : ""}
          {data.doctorName ? `, ${data.doctorName}` : ""}.
        </p>
        {phone && (
          <p className="text-corp text-cerneala">
            Vă sunăm de la <span className="telefon">{formatPhone(phone)}</span> ca să confirmăm.
          </p>
        )}
        {(comfort === "FRICA" || comfort === "EMOTII") && (
          <p className="rounded-panou bg-mustar-pal px-5 py-3 text-corp text-cerneala">
            {comfort === "FRICA" ? "Am notat că vă e teamă." : "Am notat că aveți emoții."} Medicul va ști înainte să intrați.
          </p>
        )}
        {wantsSedation && <p className="text-corp text-discret">Despre inhalosedare vorbim la telefon, când confirmăm ora.</p>}
      </div>

      <div className="da-crown-text flex flex-wrap justify-center gap-3">
        {data.manageUrl && (
          <ButtonLink href={`${data.manageUrl}/ics`} variant="primary" icon="calendar-plus" prefetch={false}>
            Adăugați în calendar
          </ButtonLink>
        )}
        {clinic?.mapsUrl && (
          <ButtonLink href={clinic.mapsUrl} variant="secondary" icon="map-pin" target="_blank" rel="noopener noreferrer">
            Deschideți harta
          </ButtonLink>
        )}
      </div>

      <details className="group da-crown-text w-full max-w-md rounded-panou border border-linie bg-suprafata text-left">
        <summary className="flex min-h-control items-center justify-between gap-3 px-4 text-control font-medium text-cerneala">
          Ce să aveți la dumneavoastră
          <Icon name="chevron-down" size={20} className="shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <ul className="list-disc px-4 pb-4 pl-9 text-corp text-cerneala">
          <li>actul de identitate;</li>
          <li>lista medicamentelor pe care le luați;</li>
          <li>radiografiile sau analizele recente, dacă le aveți.</li>
        </ul>
      </details>

      <div className="da-crown-text flex flex-col items-center gap-2">
        {data.manageUrl && (
          <a href={data.manageUrl} className="text-corp text-link underline underline-offset-4">
            Confirmați sau anulați programarea
          </a>
        )}
        <Button variant="text" onClick={onNewBooking}>
          Faceți o altă programare
        </Button>
      </div>
    </section>
  );
}
