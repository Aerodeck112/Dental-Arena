import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ServiceIndexRow } from "@/server/public/types";

/**
 * „Ce tratăm” (design-system §6.4): a two-column text index of the services. Each row has the
 * name, one plain sentence and one representative price from the CRM, right-aligned in tabular
 * figures. No icons, no cards: the row hairlines carry the table.
 */
export function ServiceIndex({
  rows,
  headingLevel = "h3",
  className,
}: {
  rows: ServiceIndexRow[];
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const H = headingLevel;
  return (
    <ul className={cn("grid gap-x-gutter md:grid-cols-2 lg:gap-x-[calc(var(--spacing-gutter)*3)]", className)}>
      {rows.map((r) => (
        <li key={r.slug} className="group relative flex flex-col border-t border-linie py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <H className="text-h3 font-semibold text-cerneala">
              <Link
                href={`/${r.slug}`}
                className="underline decoration-transparent decoration-1 underline-offset-[0.2em] group-hover:text-link group-hover:decoration-current after:absolute after:inset-0 after:content-['']"
              >
                {r.name}
              </Link>
            </H>
            {r.representative && (
              <p className="ml-auto text-right text-mic text-discret">
                <span className="sr-only">Exemplu de preț: </span>
                {r.representative.name}{" "}
                <span className="font-semibold whitespace-nowrap text-cerneala cifre">{r.representative.price}</span>
              </p>
            )}
          </div>
          <p className="mt-2 text-corp text-discret masura">{r.summary}</p>
        </li>
      ))}
    </ul>
  );
}
