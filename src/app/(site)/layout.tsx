import type { Metadata } from "next";
import { CookieConsent } from "@/components/site/CookieConsent";
import { siteUrl } from "@/server/public/seo";

/** Relative canonical and Open Graph URLs resolve against the public origin (APP_URL). */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
};

/**
 * Every public URL (the marketing pages, the booking wizard and the patient links): the skip link
 * and the Romanian cookie banner. Each child layout renders its own `<main id="continut">`.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#continut"
        className="sr-only z-[60] rounded-control bg-suprafata px-4 py-3 font-medium text-cerneala shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Salt la conținut
      </a>
      {children}
      <CookieConsent />
    </>
  );
}
