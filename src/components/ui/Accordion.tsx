import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type AccordionItem = { question: ReactNode; answer: ReactNode };

/**
 * „Întrebări” on service pages, with clinic-approved answers only. Native details/summary:
 * works without JS, keyboard and find-in-page included. `name` makes them exclusive.
 */
export function Accordion({ items, name, className }: { items: AccordionItem[]; name?: string; className?: string }) {
  return (
    <div className={cn("border-t border-linie", className)}>
      {items.map((item, i) => (
        <details key={i} name={name} className="group border-b border-linie">
          <summary className="flex min-h-control-l cursor-pointer list-none items-center justify-between gap-4 py-3 text-control font-semibold text-cerneala hover:text-link">
            <span>{item.question}</span>
            <Icon
              name="chevron-down"
              size={22}
              className="shrink-0 text-discret transition-transform duration-200 ease-filet group-open:rotate-180"
            />
          </summary>
          <div className="pb-5 text-corp text-cerneala masura">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
