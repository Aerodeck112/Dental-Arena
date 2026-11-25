import Image from "next/image";
import { JsonLd } from "@/components/site/JsonLd";
import Link from "next/link";
import { BookingBand } from "@/components/site/BookingBand";
import { ClinicCards } from "@/components/site/ClinicCards";
import { Container } from "@/components/site/Section";
import { ServiceHero } from "@/components/site/ServiceHero";
import { SitePhoto } from "@/components/site/SitePhoto";
import { getSiteImages } from "@/server/media/site-images";
import { ABOUT } from "@/content/about";
import { bookingHref } from "@/content/site";
import { pageMetadata, breadcrumbJsonLd } from "@/server/public/seo";
import { getPublicLocations } from "@/server/public/queries";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: ABOUT.seoTitle,
  description: ABOUT.description,
  path: "/despre-noi",
  image: ABOUT.heroImage,
});

const LINK = "inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2";

/** The clinic story and „Fără durere / Fără frică / Precizie”, with the texts in their correct pairing (§12.6). */
export default async function AboutPage() {
  const [locations, img] = await Promise.all([getPublicLocations(), getSiteImages(["despre.principala", "despre.secundara", "clinica.cristesti", "clinica.ludus"] as const)]);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Despre noi", path: "/despre-noi" }])} />
      <ServiceHero
        breadcrumbs={[{ href: "/", label: "Acasă" }, { label: ABOUT.title }]}
        title={ABOUT.title}
        lead={ABOUT.lead}
        image={img["despre.principala"]}
        bookingHref="/programare"
        secondary={{ href: "/echipa", label: "Cunoașteți medicii" }}
      />
      <Container className="py-sectiune">
        <div className="grid items-center gap-x-gutter gap-y-12 lg:grid-cols-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-mare bg-adancit lg:col-span-5">
            <SitePhoto image={img["despre.secundara"]} sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-6 lg:col-start-7">
            {ABOUT.story.map((p) => (
              <p key={p} className="text-corp text-cerneala masura">
                {p}
              </p>
            ))}
            <p className="text-corp font-semibold text-cerneala masura">{ABOUT.years.text}</p>
            <Link href={ABOUT.years.link.href} className={LINK}>
              {ABOUT.years.link.label}
            </Link>
          </div>
        </div>
      </Container>

      <section aria-labelledby="principii" className="bg-suprafata py-sectiune">
        <Container>
          <h2 id="principii" className="font-display text-h2 text-cerneala">
            {ABOUT.principlesTitle}
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-x-gutter gap-y-14 md:grid-cols-3">
            {ABOUT.principles.map((p) => (
              <li key={p.title}>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-mare bg-adancit">
                  <Image
                    src={p.image.src}
                    alt={p.image.alt}
                    fill
                    sizes="(min-width: 768px) 400px, 100vw"
                    className="object-cover"
                  />
                </div>
                <h3 className="mt-6 font-display text-nume text-cerneala">{p.title}</h3>
                <p className="mt-3 text-corp text-cerneala">{p.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="echipa" className="py-sectiune">
        <Container className="grid gap-x-gutter gap-y-6 lg:grid-cols-12">
          <h2 id="echipa" className="font-display text-h2 text-cerneala lg:col-span-4">
            {ABOUT.teamTitle}
          </h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="text-lead text-discret masura-lead">{ABOUT.teamText}</p>
            <Link href="/echipa" className={`${LINK} mt-2`}>
              Cunoașteți medicii
            </Link>
          </div>
        </Container>
      </section>

      <section aria-labelledby="unde" className="py-sectiune">
        <Container>
          <h2 id="unde" className="font-display text-h2 text-cerneala">
            {ABOUT.clinicsTitle}
          </h2>
          <ClinicCards locations={locations} images={{ cristesti: img["clinica.cristesti"], ludus: img["clinica.ludus"] }} className="mt-12" />
        </Container>
      </section>

      <BookingBand href={bookingHref()} />
    </>
  );
}
