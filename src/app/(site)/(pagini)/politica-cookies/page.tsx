import { LegalPage } from "@/components/site/LegalPage";
import { CookieSettingsButton } from "@/components/site/CookieConsent";
import { COOKIES } from "@/content/legal";
import { getLegalValues } from "@/server/public/queries";
import { pageMetadata } from "@/server/public/seo";

/** Company details come from Setări (clinic settings); they read „[de completat]” until entered. */
export const revalidate = 300;

export const metadata = pageMetadata({ title: COOKIES.seoTitle, description: COOKIES.description, path: "/politica-cookies" });

export default async function Page() {
  const values = await getLegalValues();
  return <LegalPage doc={COOKIES} values={values} extras={{ control: <CookieSettingsButton className="self-start font-medium text-link" /> }} />;
}
