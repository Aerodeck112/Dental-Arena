import { cn } from "@/lib/cn";
import type { PublicPrice } from "@/server/public/types";

/** The dotted leader between a name and its price: a `linie` hairline that carries data. */
function Leader() {
  return (
    <span
      aria-hidden="true"
      className="mx-3 h-[0.3em] min-w-6 flex-1 self-baseline bg-[radial-gradient(circle,var(--da-linie-control)_0.9px,transparent_1.3px)] bg-[length:7px_4px] bg-bottom bg-repeat-x opacity-70"
    />
  );
}

/**
 * Prices from the CRM catalog (design-system §6.5): name, dotted leader, price right-aligned in
 * tabular figures, formatted by `formatLei` on the server. A plain component, so both the service
 * pages (server) and the `/preturi` search (client) render it.
 */
export function PriceTable({
  prices,
  label,
  className,
}: {
  prices: PublicPrice[];
  /** Accessible name of the list, e.g. „Prețuri: Implantologie”. */
  label: string;
  className?: string;
}) {
  return (
    <dl aria-label={label} className={cn("flex flex-col", className)}>
      {prices.map((p) => (
        <div key={p.id} className="flex items-baseline py-2.5 text-corp">
          <dt className="min-w-0 text-cerneala">{p.name}</dt>
          <Leader />
          <dd
            className={cn(
              "shrink-0 text-right cifre",
              p.onRequest ? "max-w-[11rem] text-mic text-discret sm:max-w-none" : "font-semibold whitespace-nowrap text-cerneala",
            )}
          >
            {p.price}
          </dd>
        </div>
      ))}
    </dl>
  );
}
