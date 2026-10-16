import type { Metadata } from "next";
import { KpiSentence } from "@/components/crm/dashboard/KpiSentence";
import { TodayList } from "@/components/crm/dashboard/TodayList";
import { BalanceQueueRow, LeadQueueRow, RecallQueueRow, WorkQueue } from "@/components/crm/dashboard/WorkQueue";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope } from "@/lib/clinic-scope";
import { can } from "@/lib/permissions";
import { getDashboardData } from "@/server/appointments/dashboard";

export const metadata: Metadata = { title: "Azi" };

/**
 * `/crm`: Azi (WP6, design system §6.8). One sentence per clinic, today's appointments with
 * inline status actions, and the work queues: new online requests, recalls due, balances.
 */
export default async function TodayPage() {
  const user = await requirePermission("dashboard.view");
  const scope = await getClinicScope();
  const d = await getDashboardData(user, scope);
  const canCreate = can(user, ["appointments.manage", "appointments.manageOwn"]);
  const canLeads = can(user, "leads.manage");
  const canRecalls = can(user, "recalls.manage");
  const multiClinic = d.summaries.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={d.title}
        actions={
          <>
            <ButtonLink href={`/crm/programari?zi=${d.dateISO}`} variant="secondary" icon="calendar">
              Calendarul zilei
            </ButtonLink>
            {canCreate && (
              <ButtonLink href="/crm/programari/noua" icon="plus">
                Programare nouă
              </ButtonLink>
            )}
          </>
        }
      />
      <KpiSentence summaries={d.summaries} kpis={d.kpis} withLeads={d.leads !== null} reportsHref={can(user, "reports.view") ? "/crm/rapoarte" : null} />

      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="azi-programari" className="rounded-panou border border-linie bg-suprafata px-4 pt-3 pb-1 lg:col-span-8">
          <h2 id="azi-programari" className="border-b border-linie pb-2 text-h3 font-semibold">
            {d.ownDoctorId ? "Programările de azi, ale dumneavoastră întâi" : "Programările de azi"}
          </h2>
          <TodayList
            appointments={d.today}
            nowISO={d.nowISO}
            withLocation={multiClinic}
            ownDoctorId={d.ownDoctorId}
            hideCancelled
            autoRefresh
            empty="Nicio programare azi în clinica aleasă. Programările noi apar aici imediat."
          />
        </section>

        <aside aria-labelledby="azi-de-facut" className="flex flex-col gap-6 rounded-panou border border-linie bg-suprafata p-4 lg:col-span-4 lg:self-start">
          <h2 id="azi-de-facut" className="sr-only">
            De făcut
          </h2>
          {d.leads && (
            <WorkQueue title="Cereri online" count={d.leads.length} href="/crm/cereri?status=NOU" empty="Nicio cerere nouă. Cererile de pe site apar aici.">
              {d.leads.map((l) => (
                <LeadQueueRow key={l.id} lead={l} canManage={canLeads} />
              ))}
            </WorkQueue>
          )}
          <WorkQueue title="De rechemat" count={d.recalls.length} href="/crm/rechemari" empty="Nicio rechemare în următoarele 7 zile.">
            {d.recalls.map((r) => (
              <RecallQueueRow key={r.id} recall={r} todayISO={d.dateISO} canManage={canRecalls} />
            ))}
          </WorkQueue>
          {d.balances && (
            <WorkQueue title="Solduri restante" count={d.balances.length} href="/crm/incasari" empty="Niciun pacient nu are sold restant.">
              {d.balances.map((b) => (
                <BalanceQueueRow key={b.patientId} item={b} />
              ))}
            </WorkQueue>
          )}
        </aside>
      </div>
    </div>
  );
}
