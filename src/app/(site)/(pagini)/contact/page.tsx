import { HoneypotFields } from "@/components/forms/HoneypotFields";
import { ClinicSplit } from "@/components/site/ClinicSplit";
import { ContactForm } from "@/components/site/ContactForm";
import { JsonLd } from "@/components/site/JsonLd";
import { Container } from "@/components/site/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SITE } from "@/content/site";
import { dentistJsonLd, pageMetadata } from "@/server/public/seo";
import { getPublicLocations } from "@/server/public/queries";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Contact: clinicile din Cristești și Luduș",
  description:
    "Adresele, telefoanele și hărțile clinicilor Dental Arena din Cristești, lângă Târgu Mureș, și din Luduș. Ne puteți scrie și din formularul de pe pagină.",
  path: "/contact",
});

/** Both clinics split on the axis (#clinici, #cristesti, #ludus), maps behind consent, and the contact form. */
export default async function ContactPage() {
  const locations = await getPublicLocations();
  return (
    <>
      <JsonLd data={locations.map(dentistJsonLd)} />
      <Container className="pt-6 md:pt-10">
        <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: "Contact" }]} />
        <h1 className="mt-8 font-display text-h1 text-cerneala lg:mt-12">Contact</h1>
        <p className="mt-6 text-lead text-discret masura-lead">
          Sunați direct la clinica la care veniți, programați-vă online sau scrieți-ne. Vă răspundem în cel mult o zi lucrătoare.
        </p>
      </Container>

      <section id="clinici" aria-labelledby="clinici-titlu" className="scroll-mt-24 py-sectiune">
        <Container>
          <h2 id="clinici-titlu" className="sr-only">
            Clinicile
          </h2>
          <ClinicSplit locations={locations} headingLevel="h2" />
        </Container>
      </section>

      <section aria-labelledby="scrieti-ne" className="bg-suprafata py-sectiune">
        <Container className="grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="scrieti-ne" className="font-display text-h2 text-cerneala">
              Scrieți-ne
            </h2>
            <p className="mt-4 text-corp text-cerneala">
              Pentru o întrebare despre un tratament sau un preț. Pentru o programare, alegeți direct o oră.
            </p>
            <ButtonLink href="/programare" variant="secondary" className="mt-6">
              Programați-vă online
            </ButtonLink>
            <p className="mt-8 text-corp text-cerneala">
              E-mail:{" "}
              <a href={`mailto:${SITE.email}`} className="text-link underline underline-offset-[0.2em] hover:decoration-2">
                {SITE.email}
              </a>
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactForm honeypot={<HoneypotFields />} />
          </div>
        </Container>
      </section>
    </>
  );
}
