import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComfortEditor } from "@/components/crm/patients/ComfortEditor";
import { PlanProgress } from "@/components/crm/plans/PlanProgress";
import { PlanTotals } from "@/components/crm/plans/PlanTotals";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { requirePermission } from "@/lib/auth/dal";
import { capitalize, formatDateRo, formatTime } from "@/lib/format";
import { PLAN_STATUS_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { listNotes } from "@/server/patients/notes";
import { getPlan, listPlans } from "@/server/patients/plans";
import { getNextAppointment, getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Fișa pacientului" };

/** „Prezentare”: next visit, active plans with the implant thread, pinned notes, comfort. */
export default async function PatientOverviewPage({ params }: PageProps<"/crm/pacienti/[id]">) {
  const user = await requirePermission("patients.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const patient = await getPatientHeader(id);
  if (!patient) notFound();

  const canPlans = can(user, "plans.view");
  const [next, plans, pinned] = await Promise.all([
    getNextAppointment(id),
    canPlans ? listPlans(id) : Promise.resolve([]),
    listNotes(user, id, { pinnedOnly: true }),
  ]);
  const activePlans = plans.filter((p) => ["PREZENTAT", "ACCEPTAT", "IN_CURS"].includes(p.status)).slice(0, 3);
  const details = await Promise.all(activePlans.map((p) => getPlan(id, p.id)));
  const canEdit = can(user, "patients.edit") && !patient.anonymized;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="flex flex-col gap-5 lg:col-span-8">
        <Panel title="Următoarea programare" level={2}>
          {next ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-corp text-cerneala">
                <Link href={`/crm/programari/${next.id}`} className="font-semibold text-link underline underline-offset-4">
                  {capitalize(formatDateRo(next.startsAt, "long"))}, {formatTime(new Date(next.startsAt))}
                </Link>
                <span className="text-discret">
                  {" "}
                  · {next.locationName}, {next.doctorName}
                  {next.serviceName || next.reason ? `, ${next.serviceName ?? next.reason}` : ""}
                </span>
              </p>
              <StatusChip status={next.status} size="s" />
            </div>
          ) : (
            <p className="text-corp text-discret">Nicio programare viitoare.</p>
          )}
        </Panel>

        {canPlans && (
          <Panel
            title="Planuri în lucru"
            actions={
              <ButtonLink href={`/crm/pacienti/${id}/planuri`} variant="text" size="s">
                Toate planurile
              </ButtonLink>
            }
          >
            {details.length === 0 ? (
              <p className="text-corp text-discret">Niciun plan prezentat sau în curs.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-linie">
                {details.map(
                  (p) =>
                    p && (
                      <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link href={`/crm/pacienti/${id}/planuri/${p.id}`} className="text-corp font-semibold text-link underline underline-offset-4">
                            {p.title}
                          </Link>
                          <span className="text-mic text-discret">
                            {PLAN_STATUS_LABEL[p.status]}
                            {p.doctor ? `, ${p.doctor.name}` : ""}
                          </span>
                        </div>
                        <PlanProgress items={p.items} isImplant={p.isImplant} />
                        <PlanTotals totals={p.totals} compact />
                      </li>
                    ),
                )}
              </ul>
            )}
          </Panel>
        )}

        <Panel
          title="Note fixate"
          actions={
            <ButtonLink href={`/crm/pacienti/${id}/note`} variant="text" size="s">
              Toate notele
            </ButtonLink>
          }
        >
          {pinned.length === 0 ? (
            <p className="text-corp text-discret">Nicio notă fixată. Fixați din „Note” ce trebuie să vadă oricine deschide fișa.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pinned.map((n) => (
                <li key={n.id} className="text-corp text-cerneala">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="text-mic text-discret">
                    {n.clinical ? "Notă clinică, " : ""}
                    {n.author ?? "autor necunoscut"}, {formatDateRo(n.createdAt, "short")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-5 lg:col-span-4">
        <Panel title="Confort" tone="suprafata">
          {canEdit ? (
            <ComfortEditor patientId={id} comfort={patient.comfortDefault} prefersSedation={patient.prefersSedation} />
          ) : (
            <p className="text-corp text-discret">Datele de confort nu se pot modifica pentru această fișă.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
