import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";

/**
 * CRM root layout („Cabinet”): never indexed, compact density (docs/architecture.md §4.2,
 * design system §5.3). The density follows the user's preference, or the clinic default on the
 * login page. The proxy also sends `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
 */
export const metadata: Metadata = {
  title: { default: "Cabinet", template: "%s | Cabinet Dental Arena" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function CrmLayout({ children }: LayoutProps<"/crm">) {
  const user = await getCurrentUser();
  const density = user?.density ?? (await getSettings("ui")).defaultDensity;
  return (
    <div data-density={density === "CONFORTABIL" ? "confortabil" : "compact"} className="min-h-dvh bg-fundal text-cerneala">
      {children}
    </div>
  );
}
