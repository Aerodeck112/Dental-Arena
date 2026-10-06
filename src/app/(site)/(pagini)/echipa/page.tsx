import { BookingBand } from "@/components/site/BookingBand";
import { ServiceHero } from "@/components/site/ServiceHero";
import { DoctorFigure } from "@/components/site/DoctorFigure";
import { Container } from "@/components/site/Section";
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
      <ServiceHero breadcrumbs={[{ href: "/", label: "Acasă" }, { label: "Echipa" }]} title="Medicii" lead="Cinci medici, în Cristești și Luduș. Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o căutați." bookingHref="/programare" secondary={null} />
      <Container className="py-sectiune">
        <ul className="grid grid-cols-1 gap-x-gutter gap-y-14 sm:grid-cols-2 lg:grid-cols-5">
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
      <BookingBand title="Programați-vă la medicul dumneavoastră" href={bookingHref()} />
    </>
  );
}
