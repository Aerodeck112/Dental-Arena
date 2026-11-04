import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type PaginationProps = {
  /** 1-based. */
  page: number;
  pageCount: number;
  /** Path without query, e.g. "/crm/pacienti". */
  baseHref: string;
  /** The page's current searchParams; every other filter is kept in the links. */
  searchParams?: Record<string, string | string[] | undefined>;
  /** Query parameter that carries the page. Default „pagina”. */
  param?: string;
  className?: string;
};

export function pageHref(
  baseHref: string,
  searchParams: Record<string, string | string[] | undefined> | undefined,
  param: string,
  page: number,
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (k === param || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) qs.append(k, one);
  }
  if (page > 1) qs.set(param, String(page));
  const s = qs.toString();
  return s ? `${baseHref}?${s}` : baseHref;
}

/** Pages to show: first, last, current ±1, with gaps marked null. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const set = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/** Server-rendered pagination: plain links, works without JS. */
export function Pagination({ page, pageCount, baseHref, searchParams, param = "pagina", className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);
  const href = (p: number) => pageHref(baseHref, searchParams, param, p);
  const item =
    "inline-flex h-control-s min-w-control-s items-center justify-center gap-1 rounded-control px-2 text-control cifre";
  return (
    <nav aria-label="Paginare" className={cn("flex flex-wrap items-center gap-3", className)}>
      <p className="text-mic text-discret cifre">
        Pagina {current} din {pageCount}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          {current > 1 ? (
            <Link href={href(current - 1)} rel="prev" className={cn(item, "text-link hover:bg-adancit")}>
              <Icon name="chevron-left" size={18} />
              <span className="max-sm:sr-only">Înapoi</span>
            </Link>
          ) : (
            <span aria-hidden="true" className={cn(item, "text-linie-control")}>
              <Icon name="chevron-left" size={18} />
              <span className="max-sm:sr-only">Înapoi</span>
            </span>
          )}
        </li>
        {pageWindow(current, pageCount).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-discret max-sm:hidden">
              …
            </li>
          ) : (
            <li key={p} className="max-sm:hidden">
              {p === current ? (
                <span aria-current="page" className={cn(item, "bg-menta-pal font-semibold text-cerneala")}>
                  <span className="sr-only">Pagina </span>
                  {p}
                </span>
              ) : (
                <Link href={href(p)} className={cn(item, "text-link hover:bg-adancit")}>
                  <span className="sr-only">Pagina </span>
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {current < pageCount ? (
            <Link href={href(current + 1)} rel="next" className={cn(item, "text-link hover:bg-adancit")}>
              <span className="max-sm:sr-only">Înainte</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          ) : (
            <span aria-hidden="true" className={cn(item, "text-linie-control")}>
              <span className="max-sm:sr-only">Înainte</span>
              <Icon name="chevron-right" size={18} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
