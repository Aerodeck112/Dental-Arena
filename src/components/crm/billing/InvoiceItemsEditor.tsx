"use client";

import { inputClasses } from "@/components/ui/field-styles";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatLei } from "@/lib/format";
import { parseLei } from "@/lib/validation/common";
import { lineProblems, lineTotals } from "@/server/billing/totals";
import type { InvoiceLineInput, InvoiceLineSource } from "@/server/billing/types";

/** A line while it is being edited: amounts as typed (lei text), plus where it came from. */
export type EditorLine = Omit<InvoiceLineInput, "unitPrice" | "discount" | "quantity"> & {
  key: string;
  quantity: string;
  priceText: string;
  discountText: string;
  /** „Plan implant 36, faza 1, efectuat”, shown under the description. */
  context?: string | null;
};

export const SOURCE_LABEL: Record<InvoiceLineSource, string> = {
  PLAN: "Din plan",
  PROGRAMARE: "Din programare",
  CATALOG: "Din catalog",
  LIBER: "Linie liberă",
};

/** Typed line → the numeric line the server receives (null where a number does not parse). */
export function toNumericLine(l: EditorLine): (InvoiceLineInput & { invalid: string[] }) {
  const quantity = /^\d{1,3}$/.test(l.quantity.trim()) ? Number(l.quantity.trim()) : NaN;
  const unitPrice = parseLei(l.priceText) ?? NaN;
  const discount = l.discountText.trim() === "" ? 0 : (parseLei(l.discountText) ?? NaN);
  const invalid: string[] = [];
  if (Number.isNaN(quantity)) invalid.push("Cantitatea este un număr întreg între 1 și 999.");
  if (Number.isNaN(unitPrice)) invalid.push("Introduceți prețul, de exemplu 250 sau 1.200,50.");
  if (Number.isNaN(discount)) invalid.push("Reducerea este o sumă, de exemplu 50.");
  const { key: _key, priceText: _p, discountText: _d, context: _c, ...rest } = l;
  void _key;
  void _p;
  void _d;
  void _c;
  const numeric = {
    ...rest,
    quantity: Number.isNaN(quantity) ? 0 : quantity,
    unitPrice: Number.isNaN(unitPrice) ? 0 : unitPrice,
    discount: Number.isNaN(discount) ? 0 : discount,
  };
  if (invalid.length === 0) invalid.push(...lineProblems(numeric));
  return { ...numeric, invalid };
}

/**
 * The invoice lines: description, tooth, doctor (per line, for the „venit pe medic” report),
 * quantity, unit price and discount. The line total uses the same pure `lineTotals` as the server.
 */
export function InvoiceItemsEditor({
  lines,
  onChange,
  doctors,
  serverErrors,
  showErrors = false,
}: {
  lines: EditorLine[];
  onChange: (next: EditorLine[]) => void;
  doctors: { id: string; name: string }[];
  serverErrors?: Record<string, string[]>;
  /** After a submit attempt every client-side problem is shown, not only on typed prices. */
  showErrors?: boolean;
}) {
  const update = (key: string, patch: Partial<EditorLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));

  if (lines.length === 0) {
    return (
      <p className="rounded-panou border border-dashed border-linie-control px-4 py-6 text-corp text-discret">
        Factura nu are încă linii. Adăugați din planul de tratament, din programări, din catalog sau o linie liberă.
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-linie border-y border-linie" aria-label="Liniile facturii">
      {lines.map((l, i) => {
        const n = toNumericLine(l);
        const total = n.invalid.length ? null : lineTotals(n).total;
        const errs = [
          ...(n.invalid.length && (showErrors || l.priceText.trim() !== "") ? n.invalid : []),
          ...Object.entries(serverErrors ?? {})
            .filter(([k]) => k === `lines.${i}` || k.startsWith(`lines.${i}.`))
            .flatMap(([, v]) => v),
        ];
        const id = (f: string) => `linie-${i}-${f}`;
        return (
          <li key={l.key} className="grid grid-cols-6 gap-x-3 gap-y-2 py-3 lg:grid-cols-[minmax(0,1fr)_4.5rem_11rem_4.5rem_7rem_7rem_7rem_auto] lg:items-start">
            <div className="col-span-6 flex flex-col gap-1 lg:col-span-1">
              <label htmlFor={id("descriere")} className="text-mic text-discret lg:sr-only">
                Descriere, linia {i + 1}
              </label>
              <input
                id={id("descriere")}
                className={inputClasses("h-control-s")}
                value={l.description}
                maxLength={200}
                onChange={(e) => update(l.key, { description: e.target.value })}
                aria-invalid={errs.length > 0 && l.description.trim() === "" ? true : undefined}
              />
              <span className="text-micro text-discret">
                {SOURCE_LABEL[l.source]}
                {l.context ? `, ${l.context}` : ""}
              </span>
            </div>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1 lg:col-span-1">
              <label htmlFor={id("dinte")} className="text-mic text-discret lg:sr-only">
                Dinte
              </label>
              <input
                id={id("dinte")}
                className={inputClasses("h-control-s cifre")}
                inputMode="numeric"
                maxLength={2}
                value={l.tooth ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  update(l.key, { tooth: v ? Number(v) : null });
                }}
              />
            </div>
            <div className="col-span-4 flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <label htmlFor={id("medic")} className="text-mic text-discret lg:sr-only">
                Medic
              </label>
              <select
                id={id("medic")}
                className={inputClasses("h-control-s cursor-pointer")}
                value={l.doctorId ?? ""}
                onChange={(e) => update(l.key, { doctorId: e.target.value || null })}
              >
                <option value="">Fără medic</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1 lg:col-span-1">
              <label htmlFor={id("cantitate")} className="text-mic text-discret lg:sr-only">
                Cantitate
              </label>
              <input
                id={id("cantitate")}
                className={inputClasses("h-control-s text-right cifre")}
                inputMode="numeric"
                value={l.quantity}
                onChange={(e) => update(l.key, { quantity: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1 lg:col-span-1">
              <label htmlFor={id("pret")} className="text-mic text-discret lg:sr-only">
                Preț unitar (lei)
              </label>
              <input
                id={id("pret")}
                className={inputClasses("h-control-s text-right cifre")}
                inputMode="decimal"
                value={l.priceText}
                onChange={(e) => update(l.key, { priceText: e.target.value })}
                aria-invalid={Number.isNaN(parseLei(l.priceText) ?? NaN) && l.priceText !== "" ? true : undefined}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1 lg:col-span-1">
              <label htmlFor={id("reducere")} className="text-mic text-discret lg:sr-only">
                Reducere (lei)
              </label>
              <input
                id={id("reducere")}
                className={inputClasses("h-control-s text-right cifre")}
                inputMode="decimal"
                placeholder="0"
                value={l.discountText}
                onChange={(e) => update(l.key, { discountText: e.target.value })}
              />
            </div>
            <div className="col-span-4 flex flex-col gap-1 sm:col-span-1 lg:col-span-1">
              <span className="text-mic text-discret lg:sr-only">Total linie</span>
              <span className={cn("flex h-control-s items-center justify-end text-corp font-semibold cifre whitespace-nowrap", total === null && "text-discret")}>
                {total === null ? "–" : formatLei(total)}
              </span>
            </div>
            <div className="col-span-2 flex items-end justify-end sm:col-span-6 lg:col-span-1 lg:items-start">
              <Button type="button" variant="text" size="s" icon="x" onClick={() => remove(l.key)} aria-label={`Scoateți linia ${i + 1}`}>
                <span className="lg:sr-only">Scoateți</span>
              </Button>
            </div>
            {errs.length > 0 && (
              <ul className="col-span-6 flex flex-col gap-0.5 text-mic text-carmin lg:col-span-8" aria-live="polite">
                {[...new Set(errs)].map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Column headings for the wide layout (the cells carry their own labels on narrow screens). */
export function InvoiceItemsHeader() {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-[minmax(0,1fr)_4.5rem_11rem_4.5rem_7rem_7rem_7rem_auto] gap-x-3 pb-2 text-mic font-semibold text-discret lg:grid"
    >
      <span>Descriere</span>
      <span>Dinte</span>
      <span>Medic</span>
      <span className="text-right">Cant.</span>
      <span className="text-right">Preț unitar</span>
      <span className="text-right">Reducere</span>
      <span className="text-right">Total</span>
      <span className="w-16" />
    </div>
  );
}
