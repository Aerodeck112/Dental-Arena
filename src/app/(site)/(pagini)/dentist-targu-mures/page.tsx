import { LandingPage } from "@/components/site/LandingPage";
import { LANDINGS } from "@/content/landing";
import { dentistJsonLd, pageMetadata } from "@/server/public/seo";
import { getPublicDoctors, getPublicLocations, getServiceIndex } from "@/server/public/queries";

export const revalidate = 300;

const content = LANDINGS["dentist-targu-mures"];

export const metadata = pageMetadata({ title: content.seoTitle, description: content.description, path: "/dentist-targu-mures" });

/** A Târgu Mureș landing page that points to the Cristești clinic. */
export default async function Page() {
  const [index, doctors, locations] = await Promise.all([getServiceIndex(), getPublicDoctors(), getPublicLocations()]);
  const cristesti = locations.find((l) => l.slug === "cristesti") ?? null;
  return (
    <LandingPage
      content={content}
      index={index} doctors={doctors}
      location={cristesti}
      jsonLd={cristesti ? dentistJsonLd(cristesti) : null}
    />
  );
}
