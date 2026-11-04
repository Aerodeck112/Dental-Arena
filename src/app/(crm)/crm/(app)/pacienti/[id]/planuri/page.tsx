import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanCreateForm } from "@/components/crm/plans/PlanCreateForm";
import { PlanProgress } from "@/components/crm/plans/PlanProgress";
import { PlanTotals } from "@/components/crm/plans/PlanTotals";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { formatDateRo } from "@/lib/format";
import { PLAN_STATUS_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getPlan, listPlans } from "@/server/patients/plans";
import { getPatientFormOptions, getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Planuri de tratament" };

/** Treatment plans of the patient (RECEPTIE reads them to bill; ADMIN and MEDIC manage them). */
export default async function PlansPage({ params }: PageProps<"/crm/pacienti/[id]/planuri">) {
  const user = await requirePermission("plans.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, plans] = await Promise.all([getPatientHeader(id), listPlans(id)]);
  if (!patient) notFound();
  const details = await Promise.all(plans.map((p) => getPlan(id, p.id)));
  const canManage = can(user, "plans.manage") && !patient.anonymized;
  const { doctors } = canManage ? await getPatientFormOptions() : { doctors: [] };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className={canManage ? "lg:col-span-8" : "lg:col-span-12"}>
        <Panel title="Planuri de tratament">
          {details.length === 0 ? (
            <EmptyState title="Niciun plan încă. Creați unul aici sau adăugați lucrări din odontogramă." />
          ) : (
            <ul className="flex flex-col divide-y divide-linie">
              {details.map(
                (p) =>
                  p && (
                    <li key={p.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link href={`/crm/pacienti/${id}/planuri/${p.id}`} className="text-corp font-semibold text-link underline underline-offset-4">
                          {p.title}
                        </Link>
                        <span className="text-mic text-discret">
                          {PLAN_STATUS_LABEL[p.status]}
                          {p.doctor ? `, ${p.doctor.name}` : ""}, creat {formatDateRo(p.createdAt, "short")}
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
      </div>
      {canManage && (
        <div className="lg:col-span-4">
          <Panel title="Plan nou">
            <PlanCreateForm patientId={id} doctors={doctors} defaultDoctorId={user.doctorId ?? patient.primaryDoctor?.id ?? null} />
          </Panel>
        </div>
      )}
    </div>
  );
}
