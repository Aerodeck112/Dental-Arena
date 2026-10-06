import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { formatPhone, telHref } from "@/lib/format";
import { CLINIC_ORDER, CLINICS, FOOTER_NAV, LEGAL_NAV, SITE, clinicAddress } from "@/content/site";
import { AnpcBadges } from "./AnpcBadges";
import { CookieSettingsButton } from "./CookieConsent";
import { Container } from "./Section";

const LINK = "inline-flex min-h-control items-center underline decoration-1 underline-offset-[0.25em] hover:decoration-2";

/**
 * Site footer on the light page ground (the original logo needs a light background): the logo centred on the axis, the two
 * clinics split exactly on it, then the navigation, the ANPC pictograms and the legal line.
 * One text colour (`pe-subsol`) and one ring colour; the year is generated.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      data-print="ascuns"
      className="bg-fundal pt-16 pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-cerneala md:pt-20 md:pb-12"
    >
      <Container>
        <div className="flex flex-col items-center text-center">
          <Link href="/" aria-label="Dental Arena, prima pagină" className="rounded-control p-1">
            <Logo variant="full" title="" className="h-auto w-[240px] md:w-[300px]" />
          </Link>
          <p className="mt-5 font-display text-nume">{SITE.tagline}</p>
        </div>

        {/* The two clinics, split on the page axis: the logo's implant line. */}
        <ul className="relative mt-14 grid grid-cols-1 gap-y-10 md:grid-cols-2">
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-linie md:block" />
          {CLINIC_ORDER.map((slug, i) => {
            const c = CLINICS[slug];
            const number = formatPhone(c.phone);
            return (
              <li key={slug} className={i === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}>
                <h2 className="font-display text-nume">{c.shortName}</h2>
                <p className="mt-2 text-corp">
                  {clinicAddress(c)}
                  {c.area ? <span className="block">{c.area}</span> : null}
                </p>
                <a
                  href={telHref(c.phone)}
                  aria-label={`Sunați la ${c.shortName}, ${number}`}
                  className={`${LINK} telefon text-h3 font-semibold`}
                >
                  {number}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-14 grid gap-x-gutter gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <a href={`mailto:${SITE.email}`} className={`${LINK} text-corp font-medium`}>
              {SITE.email}
            </a>
            <ul className="flex flex-wrap gap-x-6">
              <li>
                <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  Facebook<span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
              </li>
              <li>
                <a href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  Instagram<span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
              </li>
            </ul>
          </div>
          <nav id="navigare-subsol" aria-label="Subsol" className="lg:col-span-8">
            <ul className="flex flex-wrap gap-x-6 gap-y-0 lg:justify-end">
              {FOOTER_NAV.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={`${LINK} text-control`}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <AnpcBadges />
          <ul className="flex flex-wrap gap-x-6">
            {LEGAL_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={LINK}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton />
            </li>
          </ul>
        </div>
        <p className="mt-6 text-legal">
          © {year} {SITE.brandName}. Toate drepturile rezervate.
        </p>
      </Container>
    </footer>
  );
}
