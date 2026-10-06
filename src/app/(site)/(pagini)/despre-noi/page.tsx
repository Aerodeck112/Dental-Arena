import Image from "next/image";
import Link from "next/link";
import { BookingCta } from "@/components/site/BookingCta";
import { ClinicSplit } from "@/components/site/ClinicSplit";
import { Container } from "@/components/site/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ABOUT } from "@/content/about";
import { bookingHref } from "@/content/site";
import { pageMetadata } from "@/server/public/seo";
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
  const locations = await getPublicLocations();
  return (
    <>
      <Container className="pt-6 pb-sectiune md:pt-10">
        <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: ABOUT.title }]} />
        <div className="mt-8 grid grid-cols-1 items-end gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h1 className="font-display text-h1 text-cerneala">{ABOUT.title}</h1>
            <p className="mt-6 text-lead text-discret masura-lead">{ABOUT.lead}</p>
          </div>
          <figure className="lg:col-span-6">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-foto bg-adancit">
              <Image src={ABOUT.heroImage.src} alt={ABOUT.heroImage.alt} fill priority sizes="(min-width: 1024px) 620px, 100vw" className="object-cover" />
            </div>
          </figure>
        </div>
        <div className="mt-16 grid gap-x-gutter lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-7 lg:col-start-2">
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
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit">
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

      <section aria-labelledby="unde" className="bg-suprafata py-sectiune">
        <Container>
          <h2 id="unde" className="font-display text-h2 text-cerneala">
            {ABOUT.clinicsTitle}
          </h2>
          <ClinicSplit locations={locations} withMap={false} className="mt-12" />
        </Container>
      </section>

      <BookingCta title="Programați o consultație" href={bookingHref()} />
    </>
  );
}
