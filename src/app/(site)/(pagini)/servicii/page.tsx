import { BookingBand } from "@/components/site/BookingBand";
import { ServiceHero } from "@/components/site/ServiceHero";
import { Container } from "@/components/site/Section";
import { ServiceIndex } from "@/components/site/ServiceIndex";
import { bookingHref } from "@/content/site";
import { pageMetadata } from "@/server/public/seo";
import { getServiceIndex } from "@/server/public/queries";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Servicii stomatologice în Cristești și Luduș",
  description:
    "Toate serviciile Dental Arena: consultație și profilaxie, stomatologie generală, inhalosedare, implantologie, chirurgie, protetică, pedodonție, ortodonție, parodontologie, estetică.",
  path: "/servicii",
});

/** All 10 services: a two-column text index with one representative price each. No cards, no icons. */
export default async function ServicesPage() {
  const rows = await getServiceIndex();
  return (
    <>
      <ServiceHero breadcrumbs={[{ href: "/", label: "Acasă" }, { label: "Servicii" }]} title="Servicii" lead="De la controlul periodic la implanturi, pentru adulți și copii. Lângă fiecare serviciu vedeți un preț din clinică; prețul exact îl aflați după consultație." bookingHref="/programare" secondary={null} />
      <Container className="py-sectiune">
        <ServiceIndex rows={rows} headingLevel="h2" />
      </Container>
      <BookingBand title="Nu știți de ce aveți nevoie? Începeți cu o consultație." href={bookingHref()} />
    </>
  );
}
