import Link from "next/link";
import { AvailabilityPanel } from "@/components/site/AvailabilityPanel";
import { BookingBand } from "@/components/site/BookingBand";
import { ClinicCards } from "@/components/site/ClinicCards";
import { ComfortQuestion } from "@/components/site/ComfortQuestion";
import { DoctorFigure } from "@/components/site/DoctorFigure";
import { JsonLd } from "@/components/site/JsonLd";
import { PriceTable } from "@/components/site/PriceTable";
import { Container } from "@/components/site/Section";
import { ServiceGrid } from "@/components/site/ServiceGrid";
import { SitePhoto } from "@/components/site/SitePhoto";
import { HOME } from "@/content/home";
import { getSiteImages } from "@/server/media/site-images";
import { dentistJsonLd, organizationJsonLd, pageMetadata } from "@/server/public/seo";
import { getPricesByCodes, getPublicDoctors, getPublicLocations, getServiceIndex } from "@/server/public/queries";
import type { PublicPrice } from "@/server/public/types";

/** The availability panel shows live slots (architecture §0.1). */
export const revalidate = 60;

export const metadata = pageMetadata({
  title: HOME.title,
  description: HOME.description,
  path: "/",
  absoluteTitle: true,
});

const SEDATION_CODE = "INH-ORA";

const LINK =
  "inline-flex min-h-control items-center font-medium text-link underline decoration-1 underline-offset-[0.2em] hover:decoration-2";
const H2 = "font-display text-[clamp(2.5rem,1.6rem+2.8vw,4.25rem)] leading-[1.02] text-cerneala";

export default async function HomePage() {
  const [doctors, index, prices, locations, img] = await Promise.all([
    getPublicDoctors(),
    getServiceIndex(),
    getPricesByCodes([...HOME.children.priceCodes, SEDATION_CODE]),
    getPublicLocations(),
    getSiteImages([
      "acasa.principala",
      "acasa.secundara",
      "acasa.confort",
      "acasa.copii",
      "acasa.tehnologie",
      "clinica.cristesti",
      "clinica.ludus",
      "serviciu.implantologie",
      "serviciu.inhalosedare",
    ] as const),
  ]);
  const childPrices = HOME.children.priceCodes.map((c) => prices.get(c)).filter((p): p is PublicPrice => !!p);
  const sedation = prices.get(SEDATION_CODE);
  const { hero, comfort, children: kids, visit } = HOME;

  return (
    <>
      <JsonLd data={[...organizationJsonLd(locations), ...locations.map(dentistJsonLd)]} />

      {/* Hero: the promise, set large on forest green, beside the clinic's own moss wall. */}
      <section aria-labelledby="titlu-acasa" className="px-3 pt-1 sm:px-4">
        <div className="relative isolate grid overflow-hidden rounded-mare bg-padure text-white lg:min-h-[min(88svh,920px)] lg:grid-cols-12">
          <div className="relative order-1 aspect-[4/3] sm:aspect-[16/9] lg:order-2 lg:col-span-5 lg:aspect-auto">
            <SitePhoto image={img["acasa.principala"]} priority sizes="(min-width: 1024px) 42vw, 100vw" position="50% 42%" />
          </div>
          <div className="order-2 flex flex-col justify-end px-6 pt-10 pb-28 sm:px-10 lg:order-1 lg:col-span-7 lg:px-16 lg:pt-28 lg:pb-36">
            <h1 id="titlu-acasa" className="font-display text-mega">
              {hero.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-8 max-w-[44ch] text-lead text-padure-text">{hero.lead}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/programare"
                className="inline-flex h-14 items-center rounded-chip bg-menta px-8 text-control font-semibold text-pe-menta transition-colors duration-150 hover:bg-white focus-visible:outline-white"
              >
                Programați-vă online
              </Link>
              <Link
                href="/servicii"
                className="inline-flex h-14 items-center rounded-chip border-[1.5px] border-white/60 px-8 text-control font-medium text-white transition-colors duration-150 hover:border-white hover:bg-white/10 focus-visible:outline-white"
              >
                Vedeți serviciile
              </Link>
            </div>
          </div>
          {/* The hand-over at reception, laid over the corner of the moss wall. */}
          <div className="absolute right-6 bottom-6 z-10 hidden aspect-[4/3] w-[min(22vw,300px)] overflow-hidden rounded-mediu border-4 border-padure lg:block xl:right-10 xl:bottom-10">
            <SitePhoto image={img["acasa.secundara"]} sizes="300px" />
          </div>
        </div>
        <Container className="relative z-10 -mt-16 lg:-mt-24">
          <AvailabilityPanel title={HOME.availability.title} fallback={HOME.availability.fallback} className="lg:max-w-[78%]" />
        </Container>
      </section>

      {/* Ce tratăm */}
      <section aria-labelledby="ce-tratam" className="pt-sectiune">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="ce-tratam" className={H2}>
                {HOME.services.title}
              </h2>
              <p className="mt-5 max-w-[52ch] text-lead text-discret">{HOME.services.lead}</p>
            </div>
            <p className="flex flex-wrap gap-x-8">
              <Link href="/preturi" className={LINK}>
                {HOME.services.allPrices}
              </Link>
              <Link href="/servicii" className={LINK}>
                Toate serviciile
              </Link>
            </p>
          </div>
          <ServiceGrid
            rows={index}
            featured={[
              { slug: "implantologie", image: img["serviciu.implantologie"] },
              { slug: "inhalosedare", image: img["serviciu.inhalosedare"] },
            ]}
            className="mt-12"
          />
        </Container>
      </section>

      {/* The comfort question: asked once, seen by the doctor before the visit. */}
      <section aria-labelledby="confort" className="px-3 pt-sectiune sm:px-4">
        <div className="grid overflow-hidden rounded-mare bg-menta-pal lg:grid-cols-12">
          <div className="px-6 py-14 sm:px-10 lg:col-span-7 lg:px-16 lg:py-24">
            <h2 id="confort" className={`${H2} max-w-[16ch]`}>
              {comfort.question}
            </h2>
            <p className="mt-6 mb-10 max-w-[46ch] text-lead text-discret">{comfort.intro}</p>
            <ComfortQuestion headingId="confort" sedationPrice={sedation?.price ?? null} />
          </div>
          <div className="relative min-h-[22rem] lg:col-span-5">
            <SitePhoto image={img["acasa.confort"]} sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        </div>
      </section>

      {/* Medicii */}
      <section aria-labelledby="medicii" className="pt-sectiune">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="medicii" className={H2}>
                {HOME.doctors.title}
              </h2>
              <p className="mt-5 max-w-[52ch] text-lead text-discret">{HOME.doctors.lead}</p>
            </div>
            <Link href="/echipa" className={LINK}>
              {HOME.doctors.all}
            </Link>
          </div>
          <ul className="-mx-margine mt-12 flex snap-x snap-mandatory scroll-px-margine gap-gutter overflow-x-auto px-margine pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {doctors.map((d) => (
              <li key={d.id} className="flex w-[72%] shrink-0 snap-start sm:w-[40%] lg:w-auto">
                <DoctorFigure doctor={d} className="w-full" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Prima vizită: a real sequence, so the steps are numbered. */}
      <section aria-labelledby="prima-vizita" className="pt-sectiune">
        <Container className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-mare bg-adancit lg:col-span-5 lg:aspect-[4/5]">
            <SitePhoto image={img["acasa.tehnologie"]} sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <h2 id="prima-vizita" className={H2}>
              {visit.title}
            </h2>
            <ol className="mt-10 flex flex-col">
              {visit.steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[3.5rem_1fr] gap-x-4 border-t border-linie py-6">
                  <span aria-hidden className="font-display text-[2.5rem] leading-none text-menta cifre">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-h3 font-semibold text-cerneala">{s.title}</h3>
                    <p className="mt-1 text-corp text-discret">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* Copiii */}
      <section aria-labelledby="copiii" className="pt-sectiune">
        <Container className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <h2 id="copiii" className={H2}>
              {kids.title}
            </h2>
            <div className="mt-8 flex flex-col gap-4">
              {kids.body.map((p) => (
                <p key={p} className="text-corp text-cerneala masura">
                  {p}
                </p>
              ))}
            </div>
            {childPrices.length > 0 && <PriceTable prices={childPrices} label="Prețuri pentru copii" className="mt-8 max-w-xl" />}
            <Link href={kids.link.href} className={`${LINK} mt-4`}>
              {kids.link.label}
            </Link>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-mare bg-adancit lg:col-span-5 lg:col-start-8">
            <SitePhoto image={img["acasa.copii"]} sizes="(min-width: 1024px) 40vw, 100vw" position="50% 60%" />
          </div>
        </Container>
      </section>

      {/* Clinicile */}
      <section aria-labelledby="clinicile" className="py-sectiune">
        <Container>
          <h2 id="clinicile" className={H2}>
            {HOME.clinics.title}
          </h2>
          <p className="mt-5 max-w-[52ch] text-lead text-discret">{HOME.clinics.lead}</p>
          <ClinicCards
            locations={locations}
            images={{ cristesti: img["clinica.cristesti"], ludus: img["clinica.ludus"] }}
            className="mt-12"
          />
        </Container>
      </section>

      <BookingBand />
    </>
  );
}
