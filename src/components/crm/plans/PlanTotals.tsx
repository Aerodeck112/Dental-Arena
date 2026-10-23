import { formatLei } from "@/lib/format";
import type { PlanTotalsDTO } from "@/server/patients/types";

/** Plan totals: subtotal, discounts, total and how much of it is done. Money as tabular figures. */
export function PlanTotals({ totals, compact = false }: { totals: PlanTotalsDTO; compact?: boolean }) {
  if (compact) {
    return (
      <p className="cifre text-corp text-cerneala">
        Total <strong className="font-semibold">{formatLei(totals.total)}</strong>
        <span className="text-discret">, efectuat {formatLei(totals.done)}</span>
      </p>
    );
  }
  const rows: [string, number, string?][] = [["Subtotal", totals.subtotal]];
  if (totals.lineDiscounts > 0) rows.push(["Reduceri pe lucrări", -totals.lineDiscounts]);
  if (totals.planDiscount > 0) rows.push(["Reducere pe plan", -totals.planDiscount]);
  return (
    <dl className="cifre ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-corp">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-discret">{label}</dt>
          <dd className="text-right">{value < 0 ? `− ${formatLei(-value)}` : formatLei(value)}</dd>
        </div>
      ))}
      <dt className="border-t border-linie pt-1 font-semibold text-cerneala">Total</dt>
      <dd className="border-t border-linie pt-1 text-right font-semibold text-cerneala">{formatLei(totals.total)}</dd>
      <dt className="text-discret">Efectuat</dt>
      <dd className="text-right text-discret">
        {formatLei(totals.done)} ({totals.doneCount} din {totals.itemCount})
      </dd>
    </dl>
  );
}
