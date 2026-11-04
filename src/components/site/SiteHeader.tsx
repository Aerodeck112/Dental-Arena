"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { isServiceSlug } from "@/content/services";
import { MAIN_NAV } from "@/content/site";
import { CallMenu } from "./CallMenu";
import { MobileMenu } from "./MobileMenu";
import { Container } from "./Section";
import { ServicesMenu } from "./ServicesMenu";

/**
 * Site header (design-system §6.3): compact lockup, the five pages, „Sunați” with both clinics and
 * „Programați-vă”. Below 1280px the pages move into „Meniu”; on phones „Sunați” and
 * „Programați-vă” move into the sticky bar. Sticky, on `fundal`, without a hairline.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const isCurrent = (href: string) => {
    if (href === "/servicii") return pathname === "/servicii" || isServiceSlug(pathname.slice(1));
    const path = href.split("#")[0];
    if (path === "/echipa") return pathname === "/echipa" || pathname.startsWith("/echipa/");
    return pathname === path;
  };

  return (
    <header data-print="ascuns" className="sticky top-0 z-40 bg-fundal/95 backdrop-blur-sm">
      <Container className="flex h-20 items-center gap-4 xl:h-24">
        <Link
          href="/"
          aria-label="Dental Arena, prima pagină"
          className="-ml-1 inline-flex min-h-control shrink-0 items-center rounded-control px-1"
        >
          <Logo variant="full" title="" priority className="h-12 w-auto xl:h-14" />
        </Link>

        <nav aria-label="Principal" className="ml-8 hidden xl:block">
          <ul className="flex items-center gap-1">
            <li>
              <ServicesMenu current={isCurrent("/servicii")} />
            </li>
            {MAIN_NAV.filter((l) => l.href !== "/servicii").map((l) => {
              const here = isCurrent(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={here && !l.href.includes("#") ? "page" : undefined}
                    className={cn(
                      "flex min-h-control items-center rounded-control px-2 text-control font-medium hover:text-link",
                      here ? "text-link underline decoration-2 underline-offset-[0.4em]" : "text-cerneala",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <CallMenu className="hidden md:block" />
          <span className="hidden md:block">
            <Link
              href="/programare"
              className="inline-flex h-12 items-center rounded-chip bg-actiune px-6 text-control font-semibold text-pe-actiune transition-colors duration-150 hover:bg-actiune-apasat"
            >
              Programați-vă
            </Link>
          </span>
          <MobileMenu className="xl:hidden" />
        </div>
      </Container>
    </header>
  );
}
