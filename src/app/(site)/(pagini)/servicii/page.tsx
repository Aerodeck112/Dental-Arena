import { BookingCta } from "@/components/site/BookingCta";
import { Container } from "@/components/site/Section";
import { ServiceIndex } from "@/components/site/ServiceIndex";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
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
      <Container className="pt-6 pb-sectiune md:pt-10">
        <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: "Servicii" }]} />
        <h1 className="mt-8 font-display text-h1 text-cerneala lg:mt-12">Servicii</h1>
        <p className="mt-6 text-lead text-discret masura-lead">
          De la controlul periodic la implanturi, pentru adulți și copii. Lângă fiecare serviciu vedeți un preț din clinică;
          prețul exact îl aflați după consultație.
        </p>
        <ServiceIndex rows={rows} headingLevel="h2" className="mt-12" />
      </Container>
      <BookingCta title="Nu știți sigur de ce aveți nevoie? Începeți cu o consultație." href={bookingHref()} />
    </>
  );
}
