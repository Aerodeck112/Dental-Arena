import Link from "next/link";
import type { ReactNode } from "react";
import { type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/cn";
import type { SiteImageDefault } from "@/content/site-images";
import { SitePhoto } from "./SitePhoto";

/**
 * The top of a service page, in the same forest-green panel as the home page: breadcrumb, the
 * title set large, the lead, an example price, the booking button and „Sunați”, and the service's
 * photo (changeable from the CRM, Fotografii site).
 */
export function ServiceHero({
  breadcrumbs,
  title,
  lead,
  bookingHref,
  bookingLabel = "Programați o consultație",
  image,
  priceHint,
  secondary = { href: "#preturi", label: "Vedeți prețurile" },
  children,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  lead: string;
  bookingHref?: string;
  bookingLabel?: string;
  image?: (SiteImageDefault & { focus?: string }) | null;
  /** One example price from the CRM, e.g. { name: "Implant Neodent", price: "2.200 lei" }. */
  priceHint?: { name: string; price: string } | null;
  /** The second, quieter link beside the booking button. */
  secondary?: { href: string; label: string } | null;
  children?: ReactNode;
}) {
  return (
    <section className="px-3 pt-1 sm:px-4">
      <div className={cn("grid overflow-hidden rounded-mare bg-padure text-white", image && "lg:grid-cols-12")}>
        <div className={cn("flex flex-col px-6 pt-8 pb-12 sm:px-10 lg:px-16 lg:pt-12 lg:pb-20", image ? "lg:col-span-7" : "")}>
          <nav aria-label="Pesmet">
            <ol className="flex flex-wrap items-center gap-x-2 text-mic text-padure-text">
              {breadcrumbs.map((b, i) => (
                <li key={b.label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  {b.href ? (
                    <Link href={b.href} className="underline decoration-transparent underline-offset-[0.2em] hover:decoration-current focus-visible:outline-white">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-white">
                      {b.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="mt-10 font-display text-[clamp(2.75rem,1.4rem+4.4vw,5.75rem)] leading-[1] lg:mt-20">{title}</h1>
          <p className="mt-6 max-w-[46ch] text-lead text-padure-text">{lead}</p>
          {priceHint && (
            <p className="mt-6 text-corp text-padure-text">
              {priceHint.name}: <span className="font-semibold whitespace-nowrap text-white cifre">{priceHint.price}</span>
            </p>
          )}
          {bookingHref && (
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href={bookingHref}
                className="inline-flex h-14 items-center rounded-chip bg-menta px-8 text-control font-semibold text-pe-menta transition-colors duration-150 hover:bg-white focus-visible:outline-white"
              >
                {bookingLabel}
              </Link>
              {secondary && (
                <Link
                  href={secondary.href}
                  className="inline-flex h-14 items-center rounded-chip border-[1.5px] border-white/60 px-8 text-control font-medium text-white transition-colors duration-150 hover:border-white hover:bg-white/10 focus-visible:outline-white"
                >
                  {secondary.label}
                </Link>
              )}
            </div>
          )}
          {children}
        </div>
        {image && (
          <div className="relative min-h-[18rem] sm:min-h-[24rem] lg:col-span-5 lg:min-h-0">
            <SitePhoto image={image} priority sizes="(min-width: 1024px) 42vw, 100vw" position={image.focus} />
          </div>
        )}
      </div>
    </section>
  );
}
