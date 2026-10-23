import { LegalPage } from "@/components/site/LegalPage";
import { CONFIDENTIALITATE } from "@/content/legal";
import { getLegalValues } from "@/server/public/queries";
import { pageMetadata } from "@/server/public/seo";

/** Company details come from Setări (clinic settings); they read „[de completat]” until entered. */
export const revalidate = 300;

export const metadata = pageMetadata({ title: CONFIDENTIALITATE.seoTitle, description: CONFIDENTIALITATE.description, path: "/politica-de-confidentialitate" });

export default async function Page() {
  const values = await getLegalValues();
  return <LegalPage doc={CONFIDENTIALITATE} values={values} />;
}
