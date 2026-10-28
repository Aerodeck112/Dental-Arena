import Link from "next/link";
import { formatLei, pluralRo } from "@/lib/format";
import type { ClinicSummary, KpiSummary } from "@/server/appointments/types";

const pct = (r: number) => `${Math.round(r * 100)}${" "}%`;

/** „Cristești: 14 programări, 3 cereri online de confirmat, 2 pacienți de rechemat. Încasat azi: 4.350 lei.” Pure. */
export function clinicSentence(s: ClinicSummary, o: { withLeads: boolean }): string {
  const parts = [pluralRo(s.appointments, "programare", "programări")];
  if (o.withLeads && s.leadsNew > 0) parts.push(`${pluralRo(s.leadsNew, "cerere online", "cereri online")} de confirmat`);
  if (s.recallsDue > 0) parts.push(`${pluralRo(s.recallsDue, "pacient", "pacienți")} de rechemat`);
  const money = s.collectedToday !== null ? ` Încasat azi: ${formatLei(s.collectedToday)}.` : "";
  return `${s.name}: ${parts.join(", ")}.${money}`;
}

/** The month in one sentence: visits, no-shows, new leads and (with `dashboard.revenue`) money. Pure. */
export function kpiSentence(k: KpiSummary): string {
  const bits = [pluralRo(k.appointmentsTotal, "programare", "programări")];
  if (k.noShowRate !== null) bits.push(`${pct(k.noShowRate)} neprezentări`);
  if (k.leadsNew > 0) bits.push(`${pluralRo(k.leadsNew, "cerere nouă", "cereri noi")}${k.leadConversionRate !== null ? `, din care ${pct(k.leadConversionRate)} programate` : ""}`);
  let s = `În ${k.monthLabel}: ${bits.join(", ")}.`;
  if (k.revenueCollected !== null) {
    s += ` Încasat ${formatLei(k.revenueCollected)}${k.revenueInvoiced !== null ? `, facturat ${formatLei(k.revenueInvoiced)}` : ""}.`;
  }
  if (k.ownProduction !== null) s += ` Producția dumneavoastră: ${formatLei(k.ownProduction)}.`;
  return s;
}

/**
 * The top of Azi (design system §6.8): one sentence per clinic, no KPI tiles, then the month in
 * one quieter sentence with a link to Rapoarte for those who may see it.
 */
export function KpiSentence({
  summaries,
  kpis,
  withLeads,
  reportsHref,
}: {
  summaries: ClinicSummary[];
  kpis: KpiSummary;
  withLeads: boolean;
  reportsHref?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {summaries.map((s) => (
        <p key={s.locationId} className="text-lead text-cerneala masura-lead">
          {clinicSentence(s, { withLeads })}
        </p>
      ))}
      <p className="text-mic text-discret">
        {kpiSentence(kpis)}
        {reportsHref && (
          <>
            {" "}
            <Link href={reportsHref} className="text-link underline underline-offset-4">
              Rapoarte
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
