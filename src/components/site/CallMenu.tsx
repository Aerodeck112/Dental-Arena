"use client";

import { Icon } from "@/components/ui/Icon";
import { buttonClasses } from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";
import { formatPhone, telHref } from "@/lib/format";
import { CLINIC_ORDER, CLINICS } from "@/content/site";
import { useDetailsDismiss } from "./use-details-dismiss";

/**
 * „Sunați”: a two-row menu, one row per clinic, because there are two numbers (design-system
 * §6.3). Each number is a tel: link named with its clinic. Works without JavaScript.
 */
export function CallMenu({
  variant = "text",
  align = "end",
  className,
}: {
  /** text: header item; secondary: outlined button beside „Programați o consultație”. */
  variant?: "text" | "secondary";
  align?: "start" | "end";
  className?: string;
}) {
  const ref = useDetailsDismiss<HTMLDetailsElement>();
  return (
    <details ref={ref} className={cn("group/call relative", className)}>
      <summary
        className={cn(
          "list-none",
          variant === "secondary"
            ? buttonClasses({ variant: "secondary", size: "m" })
            : "flex min-h-control items-center gap-1.5 rounded-control px-2 text-control font-medium text-cerneala hover:text-link group-open/call:text-link",
        )}
      >
        <Icon name="phone" size={20} />
        Sunați
        <Icon
          name="chevron-down"
          size={18}
          className="transition-transform duration-200 ease-filet group-open/call:rotate-180"
        />
      </summary>
      <div
        className={cn(
          "da-rise absolute top-full z-50 mt-3 w-[22rem] max-w-[calc(100vw-2*var(--spacing-margine))]",
          "rounded-panou border border-linie bg-suprafata p-2 shadow-float",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        <ul>
          {CLINIC_ORDER.map((slug) => {
            const c = CLINICS[slug];
            const number = formatPhone(c.phone);
            return (
              <li key={slug}>
                <a
                  href={telHref(c.phone)}
                  aria-label={`Sunați la ${c.shortName}, ${number}`}
                  className="flex min-h-control-l items-center justify-between gap-6 rounded-control px-4 text-control hover:bg-menta-pal"
                >
                  <span className="font-medium">{c.shortName}</span>
                  <span className="telefon font-semibold">{number}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
