import Link from "next/link";
import { cn } from "@/lib/cn";
import { CLINIC_ORDER, CLINICS, clinicAddress, type ClinicSlug } from "@/content/site";
import type { SiteImageDefault } from "@/content/site-images";
import type { PublicLocation } from "@/server/public/types";
import { hoursLines } from "./hours";
import { PhoneLink } from "./PhoneLink";
import { SitePhoto } from "./SitePhoto";

/**
 * Cristești and Luduș as two large photo panels: the building, then the name, address, phone,
 * hours (once published) and the two things people do next, book or get directions.
 */
export function ClinicCards({
  locations,
  images,
  headingLevel = "h3",
  className,
}: {
  locations: PublicLocation[];
  images: Record<ClinicSlug, SiteImageDefault>;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const H = headingLevel;
  const bySlug = new Map(locations.map((l) => [l.slug, l]));
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}>
      {CLINIC_ORDER.map((slug) => {
        const c = CLINICS[slug];
        const loc = bySlug.get(slug);
        const lines = loc?.publishHours ? hoursLines(loc.hours) : [];
        return (
          <article
            key={slug}
            id={slug}
            aria-labelledby={`clinica-${slug}`}
            className="flex scroll-mt-28 flex-col overflow-hidden rounded-mare border border-linie bg-suprafata"
          >
            <div className="relative aspect-[16/11] w-full bg-adancit">
              <SitePhoto image={images[slug]} sizes="(min-width: 1280px) 620px, (min-width: 768px) 48vw, 100vw" />
            </div>
            <div className="flex flex-1 flex-col p-6 md:p-8">
              <H id={`clinica-${slug}`} className="font-display text-[clamp(2rem,1.5rem+1.4vw,2.75rem)] leading-[1.05] text-cerneala">
                {c.shortName}
              </H>
              <p className="mt-3 text-corp text-cerneala">
                {clinicAddress(loc ?? c)}
                {c.area && <span className="block text-discret">{c.area}</span>}
              </p>
              <PhoneLink
                clinic={c.shortName}
                phone={loc?.phone ?? c.phone}
                showClinic={false}
                icon
                className="mt-3 self-start text-h3"
                numberClassName="font-semibold"
              />
              {lines.length > 0 && (
                <ul className="mt-4 text-mic text-discret cifre">
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex flex-wrap gap-3 pt-8">
                <Link
                  href={`/programare?clinica=${slug}`}
                  className="inline-flex h-12 items-center rounded-chip bg-actiune px-6 text-control font-semibold text-pe-actiune hover:bg-actiune-apasat"
                >
                  Programați-vă la {c.shortName}
                </Link>
                <a
                  href={c.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center rounded-chip border-[1.5px] border-cerneala px-6 text-control font-medium text-cerneala hover:bg-menta-pal"
                >
                  Indicații pe hartă<span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
