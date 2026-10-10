import type { Metadata, Viewport } from "next";
import { isTestSite } from "@/lib/site-mode";
import { forum, redHat } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dental Arena, clinică stomatologică în Cristești și Luduș",
    template: "%s | Dental Arena",
  },
  description:
    "Clinică stomatologică de familie în Cristești, lângă Târgu Mureș, și în Luduș. Consultații, implanturi, ortodonție, stomatologie pentru copii și tratament sub inhalosedare.",
  applicationName: "Dental Arena",
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Phone numbers are always explicit tel: links with the clinic's name; no auto-linking.
  formatDetection: { telephone: false, address: false, email: false },
  // A test copy (SITE_MODE=test) stays out of Google.
  ...(isTestSite ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

/**
 * Runs while the HTML is parsed, before first paint. Only the CRM has a theme choice
 * (stored by the user menu in localStorage["da-theme"]); the public site always follows
 * prefers-color-scheme. Accepts both the ThemePreference enum values and plain words.
 */
const THEME_SCRIPT = `(function(){try{if(!/^\\/crm(\\/|$)/.test(location.pathname)){document.documentElement.setAttribute("data-theme","light");return;}var t=localStorage.getItem("da-theme");var d=document.documentElement;if(t==="dark"||t==="INTUNECAT")d.setAttribute("data-theme","dark");else if(t==="light"||t==="LUMINOS")d.setAttribute("data-theme","light");}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${forum.variable} ${redHat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-fundal font-sans text-cerneala">{children}</body>
    </html>
  );
}
