import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "@/components/crm/reports/LineChart";
import { PageHeader, Panel } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { formatLei } from "@/lib/format";
import { CLINIC_SCOPE_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { getKpis, getWeeklyVisits } from "@/server/reports/metrics";
import { filterRange, parseReportFilters, reportsFor } from "@/server/reports/reports";

export const metadata: Metadata = { title: "Rapoarte" };

const percent = new Intl.NumberFormat("ro-RO", { style: "percent", maximumFractionDigits: 1 });

function count(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const mod = n % 100;
  return `${n}${n !== 0 && (mod === 0 || mod >= 20) ? " de" : ""} ${many}`;
}

/** Rapoarte: the visits-per-week chart for the clinic scope, this month in one sentence, the report list. */
export default async function ReportsPage() {
  const user = await requirePermission(["reports.view", "reports.operational", "reports.viewOwn"]);
  const scope = await getClinicScope();
  const locationIds = await scopeLocationIds(scope);
  const ownOnly = !can(user, ["reports.view", "reports.operational"]);
  const doctorId = ownOnly ? (user.doctorId ?? "__niciunul__") : null;

  const month = parseReportFilters({}, { scope });
  const { from, to } = filterRange(month);
  const [visits, kpis] = await Promise.all([
    getWeeklyVisits({ weeks: 12, locationIds, doctorId }),
    getKpis({ from, to, locationIds, doctorId }),
  ]);
  const reports = reportsFor(user);
  const groups = [
    { key: "venit", title: "Venituri și încasări", items: reports.filter((r) => r.group === "venit") },
    { key: "operational", title: "Activitate", items: reports.filter((r) => r.group === "operational") },
  ].filter((g) => g.items.length > 0);

  const scopeLabel = scope === "ambele" ? "ambele clinici" : CLINIC_SCOPE_LABEL[scope];
  const sentence = [
    `Luna aceasta, ${scopeLabel}${ownOnly ? ", programările dumneavoastră" : ""}: ${count(kpis.appointmentsTotal, "programare", "programări")}`,
    // Adjective, so no „de” (23 finalizate, not „23 de finalizate”).
    `${kpis.completed} ${kpis.completed === 1 ? "finalizată" : "finalizate"}`,
    `${count(kpis.noShows, "neprezentare", "neprezentări")}${kpis.noShowRate !== null ? ` (${percent.format(kpis.noShowRate)})` : ""}`,
  ];
  if (!ownOnly && can(user, "reports.operational")) {
    sentence.push(`${count(kpis.leadsNew, "cerere nouă", "cereri noi")}`);
  }
  if (can(user, "reports.view")) sentence.push(`facturat ${formatLei(kpis.revenueInvoiced)}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Rapoarte" subtitle={`${sentence.join(", ")}.`} />

      <Panel>
        <LineChart
          title={`Vizite pe săptămână, ultimele 12 săptămâni${ownOnly ? ", pacienții dumneavoastră" : ""}`}
          weeks={visits.weeks}
          series={visits.series}
          partialLast
        />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`grup-${g.key}`} className="flex flex-col gap-2">
            <h2 id={`grup-${g.key}`} className="text-h3 font-semibold">
              {g.title}
            </h2>
            <ul className="flex flex-col">
              {g.items.map((r) => (
                <li key={r.slug} className="border-b border-linie py-2.5">
                  <Link href={`/crm/rapoarte/${r.slug}`} className="font-semibold text-link underline-offset-2 hover:underline">
                    {r.title}
                  </Link>
                  <p className="text-mic text-discret">
                    {r.description}
                    {r.ownOnly ? " Doar programările și pacienții dumneavoastră." : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
