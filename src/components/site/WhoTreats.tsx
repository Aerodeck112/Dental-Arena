import Link from "next/link";
import { bookingHref } from "@/content/site";
import type { PublicDoctor } from "@/server/public/types";
import { ComfortNote } from "./ComfortNote";
import { DoctorPortrait } from "./DoctorFigure";

/**
 * „Cine vă tratează” (design-system §6.5): the doctors the clinic names for this service (the
 * CRM's „afișat pe site” flag). Elsewhere it says „Echipa” instead of inventing who does what.
 * The „Vă e teamă?” note sits under it.
 */
export function WhoTreats({
  doctors,
  serviceCode,
  comfortNote,
  headingId = "cine-va-trateaza",
}: {
  doctors: PublicDoctor[];
  serviceCode: string;
  comfortNote: boolean;
  headingId?: string;
}) {
  const one = doctors.length === 1;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-8">
      <div>
        <h2 id={headingId} className="font-display text-h2 text-cerneala">
          Cine vă tratează
        </h2>
        {doctors.length === 0 ? (
          <p className="mt-4 text-corp text-cerneala">
            Echipa noastră: cinci medici, în Cristești și Luduș.{" "}
            <Link href="/echipa" className="text-link underline underline-offset-[0.2em] hover:decoration-2">
              Cunoașteți medicii
            </Link>
          </p>
        ) : (
          <ul className={one ? "mt-6" : "mt-6 flex flex-col gap-6"}>
            {doctors.map((d) => (
              <li key={d.id} className={one ? "" : "grid grid-cols-[6rem_1fr] items-start gap-4"}>
                <Link href={`/echipa/${d.slug}`} tabIndex={-1} aria-hidden="true" className={one ? "block max-w-[18rem]" : "block"}>
                  <DoctorPortrait doctor={d} sizes={one ? "288px" : "96px"} />
                </Link>
                <div className={one ? "mt-4" : ""}>
                  <p className="font-display text-nume text-cerneala">
                    <Link href={`/echipa/${d.slug}`} className="underline decoration-transparent underline-offset-[0.2em] hover:text-link hover:decoration-current">
                      {d.publicName}
                    </Link>
                  </p>
                  <p className="mt-1 text-mic text-discret">{d.roleLine}</p>
                  {d.acceptsOnlineBooking && (
                    <Link
                      href={bookingHref({ serviciu: serviceCode, medic: d.slug })}
                      className="inline-flex min-h-control items-center text-control font-medium text-link underline underline-offset-[0.2em] hover:decoration-2"
                    >
                      Programați-vă la {d.shortName}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {comfortNote && <ComfortNote />}
    </section>
  );
}
