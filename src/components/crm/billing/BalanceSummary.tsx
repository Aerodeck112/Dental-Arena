import { cn } from "@/lib/cn";
import { formatLei } from "@/lib/format";
import type { BalanceDTO } from "@/server/billing/types";

/**
 * The patient's balance in one line of figures: invoiced, paid, and what is left — owed or credit.
 * The state is said in words („de plată”, „în avans”), never by colour alone.
 */
export function BalanceSummary({ balance, className }: { balance: BalanceDTO; className?: string }) {
  const owes = balance.balance > 0;
  const credit = balance.balance < 0;
  return (
    <dl className={cn("grid grid-cols-1 gap-x-8 gap-y-3 cifre sm:grid-cols-3", className)}>
      <div className="flex flex-col gap-0.5">
        <dt className="text-mic text-discret">Facturat</dt>
        <dd className="text-h3 font-semibold">{formatLei(balance.invoiced)}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-mic text-discret">Încasat</dt>
        <dd className="text-h3 font-semibold">{formatLei(balance.paid)}</dd>
      </div>
      <div className={cn("flex flex-col gap-0.5 border-l-4 pl-3", owes ? "border-cerneala" : credit ? "border-actiune" : "border-linie")}>
        <dt className="text-mic text-discret">{owes ? "Sold de plată" : credit ? "Credit în cont (avans)" : "Sold"}</dt>
        <dd className="text-h3 font-semibold">
          {formatLei(Math.abs(balance.balance))}
          <span className="ml-2 text-mic font-normal text-discret">
            {owes ? "de plată" : credit ? "în avans" : "nimic de plată"}
          </span>
        </dd>
      </div>
    </dl>
  );
}
