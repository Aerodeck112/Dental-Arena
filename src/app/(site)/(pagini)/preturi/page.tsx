import { BookingBand } from "@/components/site/BookingBand";
import { ServiceHero } from "@/components/site/ServiceHero";
import { PriceSearch } from "@/components/site/PriceSearch";
import { Container } from "@/components/site/Section";
import { bookingHref } from "@/content/site";
import { pageMetadata } from "@/server/public/seo";
import { getAllPublicCatalog } from "@/server/public/queries";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Prețuri stomatologie: lista completă",
  description:
    "Lista de prețuri Dental Arena, grupată pe servicii: consultații, tratamente, implanturi, coroane, aparate dentare și inhalosedare. Prețurile sunt orientative.",
  path: "/preturi",
});

/** Every price from the CRM catalog, grouped by service, with a diacritics-insensitive search. */
export default async function PricesPage() {
  const categories = await getAllPublicCatalog();
  const visible = categories.filter((c) => c.prices.length > 0);
  return (
    <>
      <ServiceHero breadcrumbs={[{ href: "/", label: "Acasă" }, { label: "Prețuri" }]} title="Prețuri" lead="Prețurile sunt orientative și includ manopera. Costul exact îl aflați după consultație și, unde este nevoie, după radiografii." bookingHref="/programare" secondary={null} />
      <Container className="py-sectiune">
        <PriceSearch categories={visible} />
      </Container>
      <BookingBand href={bookingHref()} />
    </>
  );
}
