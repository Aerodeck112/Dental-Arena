import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { bookingHref } from "@/content/site";
import { PORTRAITS, portraitCrop } from "@/content/portraits";
import type { PublicDoctor } from "@/server/public/types";
import { DoctorMonogram } from "./DoctorMonogram";

/**
 * A 4:5 portrait whose eyes sit on the shared line (design-system §9.3), or the monogram plate.
 * The crop is computed from measured eye positions, so the five faces line up across the row.
 */
export function DoctorPortrait({
  doctor,
  sizes,
  size = "row",
  priority = false,
  className,
}: {
  doctor: Pick<PublicDoctor, "photoPath" | "monogram" | "publicName">;
  sizes: string;
  size?: "row" | "profile";
  priority?: boolean;
  className?: string;
}) {
  const meta = doctor.photoPath ? PORTRAITS[doctor.photoPath] : undefined;
  return (
    <div className={cn("relative aspect-[4/5] w-full overflow-hidden rounded-foto bg-fundal", className)}>
      {doctor.photoPath ? (
        meta ? (
          (() => {
            const crop = portraitCrop(meta);
            return (
              <Image
                src={doctor.photoPath}
                alt={`Portretul medicului: ${doctor.publicName}`}
                width={meta.width}
                height={meta.height}
                sizes={sizes}
                priority={priority}
                className="absolute h-auto max-w-none"
                style={{ width: `${crop.widthPct}%`, left: `${crop.leftPct}%`, top: `${crop.topPct}%` }}
              />
            );
          })()
        ) : (
          <Image
            src={doctor.photoPath}
            alt={`Portretul medicului: ${doctor.publicName}`}
            fill
            sizes={sizes}
            priority={priority}
            unoptimized={doctor.photoPath.startsWith("/media/")}
            className="object-cover object-[50%_20%]"
          />
        )
      ) : (
        <DoctorMonogram monogram={doctor.monogram} size={size} />
      )}
    </div>
  );
}

/**
 * One doctor in a row (home „Medicii”, `/echipa`): portrait, name in Forum 24, role, and the
 * booking link that preselects the doctor. Not a card: no border, no shadow.
 */
export function DoctorFigure({
  doctor,
  sizes = "(min-width: 1280px) 232px, (min-width: 768px) 30vw, 72vw",
  headingLevel = "h3",
  linkName = true,
  className,
}: {
  doctor: PublicDoctor;
  sizes?: string;
  headingLevel?: "h2" | "h3";
  /** The name links to the profile. */
  linkName?: boolean;
  className?: string;
}) {
  const H = headingLevel;
  const profile = `/echipa/${doctor.slug}`;
  return (
    <figure className={cn("flex flex-col", className)}>
      <Link href={profile} tabIndex={-1} aria-hidden="true" className="block">
        <DoctorPortrait doctor={doctor} sizes={sizes} />
      </Link>
      <figcaption className="mt-4 flex flex-1 flex-col">
        <H className="font-display text-nume text-cerneala">
          {linkName ? (
            <Link href={profile} className="underline decoration-transparent underline-offset-[0.2em] hover:text-link hover:decoration-current">
              {doctor.publicName}
            </Link>
          ) : (
            doctor.publicName
          )}
        </H>
        <p className="mt-1 text-mic text-discret">{doctor.roleLine}</p>
        {doctor.acceptsOnlineBooking && (
          <p className="mt-auto pt-2">
            <Link
              href={bookingHref({ medic: doctor.slug })}
              className="inline-flex min-h-control items-center text-control font-medium text-link underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
            >
              Programați-vă la {doctor.shortName}
            </Link>
          </p>
        )}
      </figcaption>
    </figure>
  );
}
