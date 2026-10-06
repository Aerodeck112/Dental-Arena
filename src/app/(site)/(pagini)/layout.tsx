import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { StickyCallBar } from "@/components/site/StickyCallBar";

/** The marketing pages: header, footer and, on phones, the sticky „Sunați / Programați-vă” bar. */
export default function PaginiLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="continut" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <StickyCallBar />
    </div>
  );
}
