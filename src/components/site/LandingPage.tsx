import Image from "next/image";
import { breadcrumbJsonLd } from "@/server/public/seo";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CLINICS, bookingHref, clinicAddress } from "@/content/site";
import type { LandingContent } from "@/content/landing";
import type { PublicDoctor, PublicLocation, PublicPrice, ServiceIndexRow } from "@/server/public/types";
import { BookingBand } from "./BookingBand";
import { CallMenu } from "./CallMenu";
import { ComfortNote } from "./ComfortNote";
import { DoctorFigure } from "./DoctorFigure";
import { JsonLd } from "./JsonLd";
import { MapConsent } from "./MapConsent";
import { PhoneLink } from "./PhoneLink";
import { PriceTable } from "./PriceTable";
import { Container } from "./Section";
import { ServiceIndex } from "./ServiceIndex";

/**
 * The Târgu Mureș landing pages (design-system §6.2): they keep their WordPress URLs and point to
 * the Cristești clinic, „lângă Târgu Mureș”. The dentist page shows the doctors; the cabinet page
 * one representative price per service.
 */
export function LandingPage({
  content,
  index,
  doctors,
  location,
  jsonLd,
}: {
  content: LandingContent;
  index: ServiceIndexRow[];
  doctors?: PublicDoctor[];
  location: PublicLocation | null;
  jsonLd: Record<string, unknown> | null;
}) {
  const c = CLINICS.cristesti;
  const reps: PublicPrice[] = index
    .filter((r) => r.representative)
    .map((r) => ({ id: r.slug, code: null, name: r.representative!.name, price: r.representative!.price, onRequest: false }));
  return (
    <>
      <JsonLd data={[...(jsonLd ? [jsonLd] : []), breadcrumbJsonLd([{ name: content.title, path: `/${content.slug}` }])]} />
      <Container className="pt-6 pb-sectiune md:pt-10">
        <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: content.title }]} />
        <div className="mt-8 grid grid-cols-1 items-start gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h1 className="font-display text-h1 text-cerneala">{content.title}</h1>
            <p className="mt-6 text-lead text-discret masura-lead">{content.lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href={bookingHref({ clinica: "cristesti" })} size="l">
                Programați-vă în Cristești
              </ButtonLink>
              <CallMenu variant="secondary" align="start" />
            </div>
            <div className="mt-10 flex flex-col gap-4">
              {content.intro.map((p) => (
                <p key={p} className="text-corp text-cerneala masura">
                  {p}
                </p>
              ))}
            </div>
          </div>
          <figure className="lg:col-span-5 lg:col-start-8">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit">
              <Image src={c.photo.src} alt={c.photo.alt} fill priority sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-mic text-discret">Clinica Dental Arena din Cristești.</figcaption>
          </figure>
        </div>
      </Container>

      <section aria-labelledby="servicii-landing" className="bg-suprafata py-sectiune">
        <Container>
          <h2 id="servicii-landing" className="font-display text-h2 text-cerneala">
            {content.servicesTitle}
          </h2>
          <ServiceIndex rows={index} className="mt-10" />
        </Container>
      </section>

      <section aria-labelledby="focus-landing" className="py-sectiune">
        <Container>
          <h2 id="focus-landing" className="font-display text-h2 text-cerneala">
            {content.focusTitle}
          </h2>
          <p className="mt-4 text-lead text-discret masura-lead">{content.focusLead}</p>
          {doctors ? (
            <ul className="mt-10 grid grid-cols-1 gap-x-gutter gap-y-12 sm:grid-cols-2 lg:grid-cols-5">
              {doctors.map((d) => (
                <li key={d.id} className="flex">
                  <DoctorFigure doctor={d} className="w-full" sizes="(min-width: 1024px) 232px, (min-width: 640px) 45vw, 100vw" />
                </li>
              ))}
            </ul>
          ) : (
            <>
              <PriceTable prices={reps} label="Prețuri orientative, câte unul pentru fiecare serviciu" className="mt-8 max-w-3xl" />
              <Link
                href="/preturi"
                className="mt-4 inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2"
              >
                Toate prețurile
              </Link>
            </>
          )}
        </Container>
      </section>

      <section aria-labelledby="clinica-landing" className="bg-suprafata py-sectiune">
        <Container className="grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="clinica-landing" className="font-display text-h2 text-cerneala">
              {content.clinicTitle}
            </h2>
            <p className="mt-5 text-corp text-cerneala">
              {clinicAddress(location ?? c)}
              <span className="block text-discret">{c.area}</span>
            </p>
            <PhoneLink clinic={c.shortName} phone={location?.phone ?? c.phone} showClinic={false} icon className="mt-2 text-h3" numberClassName="font-semibold" />
            <ComfortNote title={content.comfortTitle} text={content.comfortText} className="mt-8" />
            <p className="mt-8 text-corp text-cerneala">
              {content.ludusNote}{" "}
              <Link href="/contact#ludus" className="text-link underline underline-offset-[0.2em] hover:decoration-2">
                Clinica din Luduș
              </Link>
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <MapConsent src={c.mapsEmbed} clinicName={c.name} mapsLink={c.mapsLink} />
          </div>
        </Container>
      </section>

      <BookingBand title="Programați o consultație în Cristești" href={bookingHref({ clinica: "cristesti" })} />
    </>
  );
}
