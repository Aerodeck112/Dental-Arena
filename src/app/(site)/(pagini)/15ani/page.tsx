import Image from "next/image";
import { JsonLd } from "@/components/site/JsonLd";
import Link from "next/link";
import { Container } from "@/components/site/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ANNIVERSARY } from "@/content/anniversary";
import { pageMetadata, breadcrumbJsonLd } from "@/server/public/seo";

export const metadata = pageMetadata({
  title: ANNIVERSARY.seoTitle,
  description: ANNIVERSARY.description,
  path: "/15ani",
  image: ANNIVERSARY.images.main,
});

/** Brand history (architecture §0.2): the 2024 anniversary, told in the past tense; never a live offer. */
export default function AnniversaryPage() {
  const { celebration, values, images } = ANNIVERSARY;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Despre noi", path: "/despre-noi" }, { name: "15 ani", path: "/15ani" }])} />
      <Container className="pt-6 pb-sectiune md:pt-10">
        <Breadcrumbs items={[{ href: "/despre-noi", label: "Despre noi" }, { label: "15 ani" }]} />
        <div className="mt-8 grid grid-cols-1 gap-x-gutter gap-y-12 lg:mt-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h1 className="font-display text-h1 text-cerneala">{ANNIVERSARY.title}</h1>
            <p className="mt-6 text-lead text-discret masura-lead">{ANNIVERSARY.lead}</p>

            <section aria-labelledby="sarbatoare" className="mt-16">
              <h2 id="sarbatoare" className="font-display text-h2 text-cerneala">
                {celebration.title}
              </h2>
              <p className="mt-5 text-corp text-cerneala masura">{celebration.intro}</p>
              <dl className="mt-6 flex flex-col gap-5">
                {celebration.items.map((i) => (
                  <div key={i.title}>
                    <dt className="text-control font-semibold text-cerneala">{i.title}</dt>
                    <dd className="mt-1 text-corp text-cerneala masura">{i.text}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 rounded-panou bg-adancit p-5 text-corp text-cerneala masura">
                {celebration.closed.replace(/pe pagina de prețuri\.$/, "")}
                {celebration.closed.endsWith("pe pagina de prețuri.") && (
                  <>
                    pe{" "}
                    <Link href="/preturi" className="text-link underline underline-offset-[0.2em] hover:decoration-2">
                      pagina de prețuri
                    </Link>
                    .
                  </>
                )}
              </p>
            </section>
          </div>
          <figure className="lg:col-span-4 lg:col-start-9">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-foto bg-adancit">
              <Image src={images.main.src} alt={images.main.alt} fill priority sizes="(min-width: 1024px) 412px, 100vw" className="object-cover" />
            </div>
          </figure>
        </div>

        <section aria-labelledby="valori" className="mt-sectiune">
          <h2 id="valori" className="font-display text-h2 text-cerneala">
            {values.title}
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {values.items.map((v) => (
              <li key={v.title}>
                <h3 className="font-display text-nume text-cerneala">{v.title}</h3>
                <p className="mt-2 text-corp text-cerneala">{v.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-sectiune grid grid-cols-1 items-center gap-x-gutter gap-y-8 lg:grid-cols-12">
          <figure className="lg:col-span-5">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-foto bg-adancit">
              <Image src={images.second.src} alt={images.second.alt} fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
            </div>
          </figure>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="font-display text-h2 text-cerneala">{ANNIVERSARY.closing}</p>
            <Link
              href="/despre-noi"
              className="mt-6 inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2"
            >
              Despre clinica noastră
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
