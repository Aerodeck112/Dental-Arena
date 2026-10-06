import Image from "next/image";
import { cn } from "@/lib/cn";
import { CLINIC_ORDER, CLINICS, clinicAddress, type ClinicSlug } from "@/content/site";
import type { PublicLocation } from "@/server/public/types";
import { hoursLines } from "./hours";
import { MapConsent } from "./MapConsent";
import { PhoneLink } from "./PhoneLink";

/**
 * Cristești and Luduș, split exactly on the page axis (design-system §2.4, §6.4): photo, address,
 * phone, the hours once the clinic publishes them, and the map behind consent. The hairline on the
 * axis is the clinic split, the one divider that carries meaning here.
 */
export function ClinicSplit({
  locations,
  withMap = true,
  headingLevel = "h3",
  images,
  className,
}: {
  /** Photos changed from the CRM (Fotografii site); the content file's photo otherwise. */
  images?: Partial<Record<ClinicSlug, { src: string; alt: string }>>;
  /** From the CRM; the content file fills in anything missing. */
  locations: PublicLocation[];
  withMap?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const H = headingLevel;
  const bySlug = new Map(locations.map((l) => [l.slug, l]));
  return (
    <div className={cn("relative grid grid-cols-1 gap-y-16 md:grid-cols-2", className)}>
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-linie md:block" />
      {CLINIC_ORDER.map((slug: ClinicSlug, i) => {
        const c = CLINICS[slug];
        const loc = bySlug.get(slug);
        const phone = loc?.phone ?? c.phone;
        const lines = loc?.publishHours ? hoursLines(loc.hours) : [];
        return (
          <article
            key={slug}
            id={slug}
            aria-labelledby={`clinica-${slug}`}
            className={cn("flex scroll-mt-28 flex-col", i === 0 ? "md:pr-[calc(var(--spacing-gutter)*2)]" : "md:pl-[calc(var(--spacing-gutter)*2)]")}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-mare bg-adancit">
              <Image
                src={images?.[slug]?.src ?? c.photo.src}
                alt={images?.[slug]?.alt ?? c.photo.alt}
                unoptimized={images?.[slug]?.src.startsWith("/media/")}
                fill
                sizes="(min-width: 1280px) 600px, (min-width: 768px) 46vw, 100vw"
                className="object-cover"
              />
            </div>
            <H id={`clinica-${slug}`} className="mt-6 font-display text-nume text-cerneala">
              {loc?.name ?? c.name}
            </H>
            <p className="mt-2 text-corp text-cerneala">
              {clinicAddress(loc ?? c)}
              {c.area && <span className="block text-discret">{c.area}</span>}
            </p>
            <PhoneLink clinic={c.shortName} phone={phone} showClinic={false} icon className="mt-2 self-start text-h3" numberClassName="font-semibold" />
            {lines.length > 0 && (
              <div className="mt-4">
                <p className="text-control font-semibold text-cerneala">Program</p>
                <ul className="mt-1 text-corp text-cerneala cifre">
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {withMap && (
              <div className="mt-auto pt-6">
                <MapConsent src={c.mapsEmbed} clinicName={c.name} mapsLink={c.mapsLink} />
              </div>
            )}
            {!withMap && (
              <a
                href={c.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-control items-center self-start font-medium text-link underline underline-offset-[0.2em] hover:decoration-2"
              >
                Deschideți în Google Maps<span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}
