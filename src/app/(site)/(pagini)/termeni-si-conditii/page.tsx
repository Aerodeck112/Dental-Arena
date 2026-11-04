import { LegalPage } from "@/components/site/LegalPage";
import { TERMENI } from "@/content/legal";
import { getLegalValues } from "@/server/public/queries";
import { pageMetadata } from "@/server/public/seo";

/** Company details come from Setări (clinic settings); they read „[de completat]” until entered. */
export const revalidate = 300;

export const metadata = pageMetadata({ title: TERMENI.seoTitle, description: TERMENI.description, path: "/termeni-si-conditii" });

export default async function Page() {
  const values = await getLegalValues();
  return <LegalPage doc={TERMENI} values={values} />;
}
