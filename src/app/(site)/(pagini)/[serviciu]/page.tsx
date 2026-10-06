import Image from "next/image";
import { notFound } from "next/navigation";
import { Accordion } from "@/components/ui/Accordion";
import { BookingBand } from "@/components/site/BookingBand";
import { PriceTable } from "@/components/site/PriceTable";
import { RelatedServices } from "@/components/site/RelatedServices";
import { Container } from "@/components/site/Section";
import { ServiceHero } from "@/components/site/ServiceHero";
import { ServiceSteps } from "@/components/site/ServiceSteps";
import { WhoTreats } from "@/components/site/WhoTreats";
import { SERVICE_SLUGS, getServiceContent } from "@/content/services";
import { bookingHref } from "@/content/site";
import { pageMetadata } from "@/server/public/seo";
import { getSiteImage } from "@/server/media/site-images";
import { getPublicCatalog } from "@/server/public/queries";

/** Prices come from the CRM; a change there shows here within five minutes, or at once after revalidatePath. */
export const revalidate = 300;
/** Only the 10 services exist; any other slug is a 404 (architecture §4.1). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICE_SLUGS.map((serviciu) => ({ serviciu }));
}

export async function generateMetadata({ params }: PageProps<"/[serviciu]">) {
  const { serviciu } = await params;
  const content = getServiceContent(serviciu);
  if (!content) return {};
  return pageMetadata({
    title: content.seoTitle,
    description: content.description,
    path: `/${content.slug}`,
    image: content.image ? { src: content.image.src, width: content.image.width, height: content.image.height, alt: content.image.alt } : undefined,
  });
}

export default async function ServicePage({ params }: PageProps<"/[serviciu]">) {
  const { serviciu } = await params;
  const content = getServiceContent(serviciu);
  if (!content) notFound();
  const [data, photo] = await Promise.all([getPublicCatalog(content.slug), getSiteImage(`serviciu.${content.slug}`)]);
  if (!data) notFound();
  const representative = data.prices.find((p) => !p.onRequest) ?? null;

  const book = bookingHref({ serviciu: data.bookingCode, confort: content.bookingComfort ?? null });
  const hasSteps = !!content.steps?.length;

  return (
    <>
      <ServiceHero
        breadcrumbs={[{ href: "/servicii", label: "Servicii" }, { label: content.title }]}
        title={content.title}
        lead={content.lead}
        bookingHref={book}
        image={photo.src === content.image?.src ? { ...photo, focus: content.image.focus } : photo}
        priceHint={representative ? { name: representative.name, price: representative.price } : null}
      />

      <Container className="grid grid-cols-1 gap-x-gutter gap-y-16 py-sectiune lg:grid-cols-12">
        <div className="flex flex-col gap-16 lg:col-span-7">
          <section aria-label={`Despre ${content.title.toLocaleLowerCase("ro-RO")}`} className="flex flex-col gap-5">
            {content.body.map((p) => (
              <p key={p} className="text-corp text-cerneala masura">
                {p}
              </p>
            ))}
            {content.secondaryImage && (
              <figure className="mt-4 max-w-md">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit">
                  <Image
                    src={content.secondaryImage.src}
                    alt={content.secondaryImage.alt}
                    fill
                    sizes="448px"
                    className="object-cover"
                    style={{ objectPosition: content.secondaryImage.focus ?? "50% 50%" }}
                  />
                </div>
                {content.secondaryImage.caption && (
                  <figcaption className="mt-3 text-mic text-discret">{content.secondaryImage.caption}</figcaption>
                )}
              </figure>
            )}
          </section>
          {hasSteps && <ServiceSteps steps={content.steps ?? []} note={content.stepsNote} />}
        </div>

        <aside className="lg:col-span-4 lg:col-start-9" aria-label="Medicii și confortul">
          <div className="lg:sticky lg:top-28">
            <WhoTreats doctors={data.doctors} serviceCode={data.bookingCode} comfortNote={content.comfortNote} />
          </div>
        </aside>

        <section aria-labelledby="preturi" className="lg:col-span-8">
          <h2 id="preturi" className="font-display text-h2 text-cerneala">
            Prețuri
          </h2>
          {data.prices.length > 0 ? (
            <PriceTable prices={data.prices} label={`Prețuri: ${content.title}`} className="mt-6" />
          ) : (
            <p className="mt-4 text-corp text-cerneala">Prețul îl aflați la telefon.</p>
          )}
          <p className="mt-6 text-mic text-discret masura">{content.priceNote}</p>
        </section>

        {content.faqs.length > 0 && (
          <section aria-labelledby="intrebari" className="lg:col-span-8">
            <h2 id="intrebari" className="font-display text-h2 text-cerneala">
              Întrebări
            </h2>
            <Accordion items={content.faqs} name="intrebari" className="mt-6" />
          </section>
        )}
      </Container>

      <Container className="pb-12">
        <RelatedServices slugs={content.related} />
      </Container>
      <BookingBand title={content.ctaTitle} href={book} />

    </>
  );
}
