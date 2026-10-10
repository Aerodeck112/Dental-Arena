import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/site/Section";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CLINIC_ORDER, CLINICS } from "@/content/site";
import { PhoneLink } from "@/components/site/PhoneLink";

export const metadata: Metadata = {
  title: "Pagina nu există",
  robots: { index: false },
};

/**
 * The site-wide 404 (the CRM has its own under /crm). It renders inside the root layout only, so
 * it brings the site header and footer itself. The moss wall with the logo, and a way on.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="continut" tabIndex={-1} className="flex-1 outline-none">
        <Container className="grid grid-cols-1 items-center gap-x-gutter gap-y-10 py-sectiune lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h1 className="font-display text-h1 text-cerneala">Pagina aceasta nu există.</h1>
            <p className="mt-6 text-lead text-discret masura-lead">
              Poate a fost mutată când am refăcut site-ul. Găsiți serviciile, prețurile și programarea de mai jos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/" size="l">
                Mergeți la prima pagină
              </ButtonLink>
              <ButtonLink href="/programare" variant="secondary" size="l">
                Programați-vă
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6">
              {[
                { href: "/servicii", label: "Servicii" },
                { href: "/preturi", label: "Prețuri" },
                { href: "/echipa", label: "Echipa" },
                { href: "/contact", label: "Contact" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-6 flex flex-wrap gap-x-8">
              {CLINIC_ORDER.map((s) => (
                <li key={s}>
                  <PhoneLink clinic={CLINICS[s].shortName} phone={CLINICS[s].phone} icon />
                </li>
              ))}
            </ul>
          </div>
          <figure className="lg:col-span-4 lg:col-start-9">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-foto bg-adancit">
              <Image
                src="/images/clinica/perete-muschi.jpg"
                alt="Peretele de mușchi viu din clinică, cu sigla Dental Arena"
                fill
                sizes="(min-width: 1024px) 412px, 100vw"
                className="object-cover"
              />
            </div>
          </figure>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
