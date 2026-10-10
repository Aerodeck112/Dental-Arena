import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";
import { CLINIC_ORDER, CLINICS } from "@/content/site";
import { PhoneLink } from "./PhoneLink";
import { Container } from "./Section";

/**
 * The closing booking band (design-system §6.5), on `menta-pal`: the title, one primary button
 * that carries the service into the wizard, and both phones split on the page axis.
 */
export function BookingCta({
  title,
  href,
  buttonLabel = "Alegeți o oră",
  headingId = "programare-cta",
  className,
}: {
  title: string;
  href: string;
  buttonLabel?: string;
  headingId?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={headingId} className={cn("bg-menta-pal py-16 md:py-20", className)}>
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 id={headingId} className="max-w-[22ch] font-display text-h2 text-cerneala">
            {title}
          </h2>
          <ButtonLink href={href} size="l" className="self-start md:self-auto">
            {buttonLabel}
          </ButtonLink>
        </div>
        <ul className="relative mt-10 grid gap-y-2 sm:grid-cols-2">
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-linie-control/50 sm:block" />
          {CLINIC_ORDER.map((slug, i) => {
            const c = CLINICS[slug];
            return (
              <li key={slug} className={i === 0 ? "sm:pr-8 sm:text-right" : "sm:pl-8"}>
                <PhoneLink
                  clinic={c.shortName}
                  phone={c.phone}
                  className="gap-3 text-h3"
                  numberClassName="font-semibold"
                />
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
