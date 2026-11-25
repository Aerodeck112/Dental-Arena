"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { inputClasses } from "@/components/ui/field-styles";
import { normalizeSearch } from "@/lib/search";
import type { PublicCategory } from "@/server/public/types";
import { PriceTable } from "./PriceTable";
import { useHydrated } from "./use-hydrated";

/**
 * `/preturi`: every price, grouped by service, with a client-side search that ignores diacritics
 * („extractie” finds „Extracție”). Without JavaScript the full list is shown and the field is
 * hidden. Group names match too, so „implant” keeps the whole Implantologie group.
 */
export function PriceSearch({ categories }: { categories: PublicCategory[] }) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputId = useId();
  const statusId = useId();

  const index = useMemo(
    () =>
      categories.map((c) => ({
        category: c,
        group: normalizeSearch(c.name),
        rows: c.prices.map((p) => ({ price: p, text: normalizeSearch(p.name) })),
      })),
    [categories],
  );

  const terms = normalizeSearch(deferred).split(" ").filter(Boolean);
  const results = terms.length
    ? index
        .map(({ category, group, rows }) => {
          const groupHit = terms.every((t) => group.includes(t));
          const prices = groupHit ? category.prices : rows.filter((r) => terms.every((t) => r.text.includes(t) || group.includes(t))).map((r) => r.price);
          return { ...category, prices };
        })
        .filter((c) => c.prices.length > 0)
    : categories;
  const count = results.reduce((n, c) => n + c.prices.length, 0);

  return (
    <div>
      {hydrated && (
      <form role="search" onSubmit={(e) => e.preventDefault()} className="max-w-xl">
        <label htmlFor={inputId} className="mb-2 block text-control font-medium text-cerneala">
          Căutați un tratament
        </label>
        <div className="relative">
          <Icon name="search" size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-discret" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            aria-describedby={statusId}
            placeholder="de exemplu: extracție, coroană, aparat"
            className={inputClasses("pl-11")}
          />
        </div>
        <p id={statusId} role="status" className="mt-2 text-mic text-discret cifre">
          {terms.length ? (count === 1 ? "Un preț găsit." : count === 0 ? "" : `${count} prețuri găsite.`) : ""}
        </p>
      </form>
      )}

      {results.length === 0 ? (
        <div className="mt-10 max-w-xl rounded-panou bg-suprafata p-6">
          <p className="text-h3 font-semibold text-cerneala">Nu am găsit „{query.trim()}” în lista de prețuri.</p>
          <p className="mt-2 text-corp text-cerneala">
            Încercați alt cuvânt sau{" "}
            <Link href="/contact#clinici" className="text-link underline underline-offset-[0.2em] hover:decoration-2">
              sunați-ne
            </Link>
            : vă spunem prețul la telefon.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-14">
          {results.map((c) => (
            <section key={c.id} aria-labelledby={`grup-${c.slug}`} className="grid gap-x-gutter gap-y-3 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 id={`grup-${c.slug}`} className="font-display text-nume text-cerneala">
                  {c.name}
                </h2>
                <Link
                  href={`/${c.slug}`}
                  className="mt-1 inline-flex min-h-control items-center text-mic text-link underline underline-offset-[0.2em] hover:decoration-2"
                >
                  Despre {c.name.toLocaleLowerCase("ro-RO")}
                </Link>
              </div>
              <PriceTable prices={c.prices} label={`Prețuri: ${c.name}`} className="lg:col-span-8" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
