import Link from "next/link";
import { cn } from "@/lib/cn";

export type BreadcrumbItem = { href?: string; label: string };

/** „Servicii / Implantologie”. The last item is the current page and is not a link. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Cale de navigare" className={cn("text-mic text-discret", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-2">
              {item.href && !last ? (
                <Link href={item.href} className="text-discret underline underline-offset-4 hover:text-link hover:decoration-2">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-cerneala")}>
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-linie-control">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
