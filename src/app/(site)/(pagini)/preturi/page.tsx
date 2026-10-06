import { BookingCta } from "@/components/site/BookingCta";
import { PriceSearch } from "@/components/site/PriceSearch";
import { Container } from "@/components/site/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
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
      <Container className="pt-6 pb-sectiune md:pt-10">
        <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: "Prețuri" }]} />
        <h1 className="mt-8 font-display text-h1 text-cerneala lg:mt-12">Prețuri</h1>
        <p className="mt-6 mb-10 text-lead text-discret masura-lead">
          Prețurile sunt orientative și includ manopera. Costul exact îl aflați după consultație și, unde este nevoie, după
          radiografii.
        </p>
        <PriceSearch categories={visible} />
      </Container>
      <BookingCta title="Programați o consultație" href={bookingHref()} />
    </>
  );
}
