import Link from "next/link";
import { cn } from "@/lib/cn";
import type { SiteImageDefault } from "@/content/site-images";
import type { ServiceIndexRow } from "@/server/public/types";
import { SitePhoto } from "./SitePhoto";

/**
 * „Ce tratăm” as a grid with two weights: the first two services (the ones people ask about most)
 * are large photo panels; the other eight are quiet tiles. Each tile is one link to the service
 * page; the price shown is the representative price from the CRM.
 */
export function ServiceGrid({
  rows,
  featured,
  className,
}: {
  rows: ServiceIndexRow[];
  /** Photos of the featured services, by slug. Services listed here are shown large, in this order. */
  featured: { slug: string; image: SiteImageDefault }[];
  className?: string;
}) {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const big = featured.flatMap((f) => {
    const r = bySlug.get(f.slug);
    return r ? [{ row: r, image: f.image }] : [];
  });
  const rest = rows.filter((r) => !featured.some((f) => f.slug === r.slug));

  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12", className)}>
      {big.map(({ row, image }) => (
        <Link
          key={row.slug}
          href={`/${row.slug}`}
          className="group relative isolate flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-mare bg-padure p-6 text-white md:min-h-[26rem] lg:col-span-6 lg:p-8"
        >
          <SitePhoto
            image={image}
            sizes="(min-width: 1024px) 640px, (min-width: 768px) 50vw, 100vw"
            className="-z-10 transition-transform duration-700 ease-filet group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-padure via-padure/55 to-transparent" />
          <h3 className="font-display text-[clamp(2rem,1.4rem+1.6vw,2.75rem)] leading-[1.05]">{row.name}</h3>
          <p className="mt-3 max-w-[46ch] text-corp text-padure-text">{row.summary}</p>
          {row.representative && (
            <p className="mt-4 text-mic text-padure-text">
              {row.representative.name}: <span className="font-semibold whitespace-nowrap text-white cifre">{row.representative.price}</span>
            </p>
          )}
        </Link>
      ))}
      {rest.map((r) => (
        <Link
          key={r.slug}
          href={`/${r.slug}`}
          className="group flex min-h-[13rem] flex-col rounded-mediu border border-linie bg-suprafata p-6 transition-colors duration-200 hover:border-actiune hover:bg-menta-pal lg:col-span-3"
        >
          <h3 className="font-display text-[1.75rem] leading-[1.1] text-cerneala">{r.name}</h3>
          <p className="mt-3 line-clamp-4 text-mic text-discret">{r.summary}</p>
          {r.representative && (
            <p className="mt-auto pt-5 text-mic text-discret">
              <span className="sr-only">Exemplu de preț: </span>
              {r.representative.name}{" "}
              <span className="font-semibold whitespace-nowrap text-cerneala cifre">{r.representative.price}</span>
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
