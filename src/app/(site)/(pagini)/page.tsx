import Image from "next/image";
import Link from "next/link";
import { AvailabilityPanel } from "@/components/site/AvailabilityPanel";
import { ClinicSplit } from "@/components/site/ClinicSplit";
import { ComfortQuestion } from "@/components/site/ComfortQuestion";
import { DoctorFigure } from "@/components/site/DoctorFigure";
import { JsonLd } from "@/components/site/JsonLd";
import { PriceTable } from "@/components/site/PriceTable";
import { Container } from "@/components/site/Section";
import { ServiceIndex } from "@/components/site/ServiceIndex";
import { HOME } from "@/content/home";
import { dentistJsonLd, pageMetadata } from "@/server/public/seo";
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

export default async function HomePage() {
  const [doctors, index, prices, locations] = await Promise.all([
    getPublicDoctors(),
    getServiceIndex(),
    getPricesByCodes([...HOME.children.priceCodes, SEDATION_CODE]),
    getPublicLocations(),
  ]);
  const childPrices = HOME.children.priceCodes.map((c) => prices.get(c)).filter((p): p is PublicPrice => !!p);
  const sedation = prices.get(SEDATION_CODE);
  const { hero, comfort, children: kids } = HOME;

  return (
    <>
      <JsonLd data={locations.map(dentistJsonLd)} />

      {/* Hero: the clinic's promise, the hand-over at reception, and the first free hours. */}
      <section aria-labelledby="titlu-acasa" className="pt-6 pb-sectiune md:pt-10">
        <Container className="grid grid-cols-1 gap-x-gutter lg:grid-cols-12">
          <div className="lg:col-span-7 lg:row-start-1 lg:pt-14">
            <h1 id="titlu-acasa" className="font-display text-hero text-cerneala">
              {hero.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-8 text-lead text-discret masura-lead">{hero.lead}</p>
          </div>
          <figure className="order-3 mt-10 lg:order-none lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:mt-0">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit lg:aspect-[4/5]">
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                fill
                priority
                sizes="(min-width: 1280px) 412px, (min-width: 1024px) 32vw, 100vw"
                className="object-cover object-[var(--foto-lat)] lg:object-[var(--foto-inalt)]"
                style={{ ["--foto-lat" as string]: hero.image.focusWide, ["--foto-inalt" as string]: hero.image.focusTall }}
              />
            </div>
          </figure>
          <div className="relative z-10 mt-10 lg:col-span-12 lg:row-start-2 lg:-mt-12">
            <AvailabilityPanel title={HOME.availability.title} fallback={HOME.availability.fallback} />
          </div>
        </Container>
      </section>

      {/* The comfort question: asked once, seen by the doctor before the visit. */}
      <section aria-labelledby="confort" className="bg-suprafata py-sectiune">
        <Container className="grid grid-cols-1 items-start gap-x-gutter gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-7 lg:pt-16">
            <h2 id="confort" className="max-w-[20ch] font-display text-h2 text-cerneala">
              {comfort.question}
            </h2>
            <p className="mt-4 mb-8 text-lead text-discret masura-lead">{comfort.intro}</p>
            <ComfortQuestion headingId="confort" sedationPrice={sedation?.price ?? null} />
          </div>
          <figure className="lg:col-span-4 lg:col-start-9">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-foto bg-adancit">
              <Image
                src={comfort.image.src}
                alt={comfort.image.alt}
                fill
                sizes="(min-width: 1024px) 412px, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-mic text-discret">{comfort.image.caption}</figcaption>
          </figure>
        </Container>
      </section>

      {/* Medicii */}
      <section aria-labelledby="medicii" className="py-sectiune">
        <Container>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="medicii" className="font-display text-h2 text-cerneala">
                {HOME.doctors.title}
              </h2>
              <p className="mt-4 text-lead text-discret masura-lead">{HOME.doctors.lead}</p>
            </div>
            <Link href="/echipa" className={LINK}>
              {HOME.doctors.all}
            </Link>
          </div>
          <ul className="-mx-margine mt-10 flex snap-x snap-mandatory scroll-px-margine gap-gutter overflow-x-auto px-margine pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {doctors.map((d) => (
              <li key={d.id} className="flex w-[72%] shrink-0 snap-start sm:w-[40%] lg:w-auto">
                <DoctorFigure doctor={d} className="w-full" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Ce tratăm */}
      <section aria-labelledby="ce-tratam" className="bg-suprafata py-sectiune">
        <Container>
          <h2 id="ce-tratam" className="font-display text-h2 text-cerneala">
            {HOME.services.title}
          </h2>
          <p className="mt-4 text-lead text-discret masura-lead">{HOME.services.lead}</p>
          <ServiceIndex rows={index} className="mt-10" />
          <p className="mt-6 flex flex-wrap gap-x-8">
            <Link href="/preturi" className={LINK}>
              {HOME.services.allPrices}
            </Link>
            <Link href="/servicii" className={LINK}>
              Toate serviciile
            </Link>
          </p>
        </Container>
      </section>

      {/* Copiii */}
      <section aria-labelledby="copiii" className="py-sectiune">
        <Container className="grid grid-cols-1 items-center gap-x-gutter gap-y-10 lg:grid-cols-12">
          <figure className="lg:col-span-5">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-foto bg-adancit sm:aspect-[4/3] lg:aspect-[3/4]">
              <Image
                src={kids.image.src}
                alt={kids.image.alt}
                fill
                sizes="(min-width: 1024px) 520px, 100vw"
                className="object-cover object-[50%_60%]"
              />
            </div>
            <figcaption className="mt-3 text-mic text-discret">{kids.image.caption}</figcaption>
          </figure>
          <div className="lg:col-span-6 lg:col-start-7">
            <h2 id="copiii" className="font-display text-h2 text-cerneala">
              {kids.title}
            </h2>
            <div className="mt-6 flex flex-col gap-4">
              {kids.body.map((p) => (
                <p key={p} className="text-corp text-cerneala masura">
                  {p}
                </p>
              ))}
            </div>
            {childPrices.length > 0 && (
              <PriceTable prices={childPrices} label="Prețuri pentru copii" className="mt-8 max-w-xl" />
            )}
            <Link href={kids.link.href} className={`${LINK} mt-4`}>
              {kids.link.label}
            </Link>
          </div>
        </Container>
      </section>

      {/* Clinicile, split on the axis */}
      <section aria-labelledby="clinicile" className="bg-suprafata py-sectiune">
        <Container>
          <h2 id="clinicile" className="font-display text-h2 text-cerneala">
            {HOME.clinics.title}
          </h2>
          <p className="mt-4 text-lead text-discret masura-lead">{HOME.clinics.lead}</p>
          <ClinicSplit locations={locations} className="mt-12" />
        </Container>
      </section>
    </>
  );
}
