"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CountBadge } from "./CountBadge";

export type TabItem = { href: string; label: string; count?: number };

/** The tab whose href is the longest prefix of the path ("/crm/pacienti/1" vs "/crm/pacienti/1/plan"). */
export function activeTabHref(pathname: string, items: { href: string }[]): string | null {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
  let best: string | null = null;
  for (const { href } of items) {
    const h = href.split("?")[0].replace(/\/$/, "") || "/";
    if (path === h || path.startsWith(h + "/")) {
      if (!best || h.length > best.length) best = h;
    }
  }
  return best;
}

/**
 * Link tabs for sub-pages (patient file: Prezentare, Odontogramă, Plan de tratament…).
 * They are navigation, so the active one is `aria-current="page"`, not an ARIA tab.
 */
export function Tabs({ items, label = "Secțiuni", className }: { items: TabItem[]; label?: string; className?: string }) {
  const pathname = usePathname() ?? "";
  const active = activeTabHref(pathname, items);
  return (
    <nav aria-label={label} className={cn("border-b border-linie", className)}>
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const h = item.href.split("?")[0].replace(/\/$/, "") || "/";
          const current = h === active;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-control items-center gap-2 border-b-[3px] px-3 text-control whitespace-nowrap",
                  "outline-offset-[-2px] transition-colors duration-150",
                  current
                    ? "border-actiune font-semibold text-cerneala"
                    : "border-transparent text-discret hover:border-linie-control hover:text-cerneala",
                )}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && <CountBadge count={item.count} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
