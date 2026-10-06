import { BookingCta } from "@/components/site/BookingCta";
import { DoctorFigure } from "@/components/site/DoctorFigure";
import { Container } from "@/components/site/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { bookingHref } from "@/content/site";
import { pageMetadata } from "@/server/public/seo";
import { getPublicDoctors } from "@/server/public/queries";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Medicii Dental Arena",
  description:
    "Cei cinci medici Dental Arena din Cristești și Luduș: stomatologie generală, implantologie, chirurgie dento-alveolară și ortodonție. Vă programați direct la medicul ales.",
  path: "/echipa",
});

/** The team (design-system §6.6): five 4:5 portraits on one eye-line; Dr. Podar gets the monogram plate. */
export default async function TeamPage() {
  const doctors = await getPublicDoctors();
  return (
    <>
      <Container className="pt-6 pb-sectiune md:pt-10">
        <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: "Echipa" }]} />
        <h1 className="mt-8 font-display text-h1 text-cerneala lg:mt-12">Medicii</h1>
        <p className="mt-6 text-lead text-discret masura-lead">
          Cinci medici, în Cristești și Luduș. Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o
          căutați.
        </p>
        <ul className="mt-14 grid grid-cols-1 gap-x-gutter gap-y-14 sm:grid-cols-2 lg:grid-cols-5">
          {doctors.map((d) => (
            <li key={d.id} className="flex">
              <DoctorFigure
                doctor={d}
                headingLevel="h2"
                sizes="(min-width: 1280px) 232px, (min-width: 1024px) 18vw, (min-width: 640px) 45vw, 100vw"
                className="w-full"
              />
            </li>
          ))}
        </ul>
      </Container>
      <BookingCta title="Programați-vă la medicul dumneavoastră" href={bookingHref()} />
    </>
  );
}
