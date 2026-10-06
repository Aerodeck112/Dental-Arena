"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { SERVICE_LIST } from "@/content/services";
import { useDetailsDismiss } from "./use-details-dismiss";

/**
 * „Servicii” in the desktop header: a two-column text list of the 10 services, no icons
 * (design-system §6.3). A native disclosure, so it also opens without JavaScript.
 */
export function ServicesMenu({ current }: { current: boolean }) {
  const ref = useDetailsDismiss<HTMLDetailsElement>();
  const pathname = usePathname();
  return (
    <details ref={ref} className="group/menu relative">
      <summary
        className={cn(
          "flex min-h-control list-none items-center gap-1.5 rounded-control px-2 text-control font-medium",
          "hover:text-link group-open/menu:text-link",
          current ? "text-link underline decoration-2 underline-offset-[0.4em]" : "text-cerneala",
        )}
      >
        Servicii
        <Icon
          name="chevron-down"
          size={18}
          className="transition-transform duration-200 ease-filet group-open/menu:rotate-180"
        />
      </summary>
      <div
        className={cn(
          "da-rise absolute top-full left-[-1.5rem] z-50 mt-3 w-[42rem] max-w-[calc(100vw-2*var(--spacing-margine))]",
          "rounded-panou border border-linie bg-suprafata p-6 shadow-float",
        )}
      >
        <ul className="grid grid-flow-col grid-cols-2 grid-rows-5 gap-x-8">
          {SERVICE_LIST.map((s) => {
            const here = pathname === `/${s.slug}`;
            return (
              <li key={s.slug}>
                <Link
                  href={`/${s.slug}`}
                  aria-current={here ? "page" : undefined}
                  className={cn(
                    "flex min-h-control items-center text-control text-cerneala underline-offset-4 hover:text-link hover:underline",
                    here && "font-semibold text-link underline",
                  )}
                >
                  {s.title}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex flex-wrap gap-x-8 border-t border-linie pt-4">
          <Link href="/servicii" className="inline-flex min-h-control items-center font-medium text-link underline underline-offset-4 hover:decoration-2">
            Toate serviciile
          </Link>
          <Link href="/preturi" className="inline-flex min-h-control items-center font-medium text-link underline underline-offset-4 hover:decoration-2">
            Toate prețurile
          </Link>
        </p>
      </div>
    </details>
  );
}
