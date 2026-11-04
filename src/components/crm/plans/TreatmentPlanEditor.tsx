"use client";

import { useState } from "react";
import { setPlanStatusAction, updatePlanAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/planuri/actions";
import { runPatientAction, usePatientAction } from "@/components/crm/patients/use-patient-action";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { PlanStatus } from "@/generated/prisma/enums";
import { formatAmount, formatDateRo } from "@/lib/format";
import { PLAN_STATUS_LABEL } from "@/lib/labels";
import { PLAN_STATUS_ACTION, PLAN_TRANSITIONS, planOpen, planPricesEditable } from "@/server/patients/plan-math";
import type { PlanDetailDTO } from "@/server/patients/types";
import { PlanItemForm, PlanItemRow, type PlanService } from "./PlanItemRow";
import type { ReactNode } from "react";

type Props = {
  patientId: string;
  plan: PlanDetailDTO;
  services: PlanService[];
  doctors: { id: string; name: string }[];
  canManage: boolean;
  /** Server-rendered progress (thread) and totals. */
  progress: ReactNode;
  totals: ReactNode;
};

const DANGEROUS: PlanStatus[] = ["ANULAT", "RESPINS"];

/**
 * Plan editor: title, doctor, plan discount and notes; the status flow
 * CIORNA → PREZENTAT → ACCEPTAT → IN_CURS → FINALIZAT; lines grouped by phase; a new line.
 */
export function TreatmentPlanEditor({ patientId, plan, services, doctors, canManage, progress, totals }: Props) {
  const open = planOpen(plan.status);
  const editable = canManage && open;
  const pricesEditable = planPricesEditable(plan.status);
  const [confirm, setConfirm] = useState<PlanStatus | null>(null);
  const [pending, setPending] = useState(false);
  const header = usePatientAction(updatePlanAction);
  const phases = [...new Set(plan.items.map((i) => i.phase))].sort((a, b) => a - b);

  async function move(to: PlanStatus) {
    setPending(true);
    const r = await runPatientAction(setPlanStatusAction({ id: patientId, planId: plan.id, status: to }));
    setPending(false);
    if (r.ok) setConfirm(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title={
          <span className="flex flex-wrap items-baseline gap-x-3">
            {plan.title}
            <span className="text-mic font-normal text-discret">
              {PLAN_STATUS_LABEL[plan.status]}
              {plan.presentedAt ? `, prezentat ${formatDateRo(plan.presentedAt, "short")}` : ""}
              {plan.acceptedAt ? `, acceptat ${formatDateRo(plan.acceptedAt, "short")}` : ""}
            </span>
          </span>
        }
        actions={
          <ButtonLink href={`/crm/pacienti/${patientId}/planuri/${plan.id}/tipar`} variant="secondary" size="s" icon="printer">
            Deviz de tipărit
          </ButtonLink>
        }
      >
        <div className="flex flex-col gap-4">
          {progress}
          {canManage && PLAN_TRANSITIONS[plan.status].length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Schimbați statusul planului" role="group">
              {PLAN_TRANSITIONS[plan.status].map((to) => (
                <Button
                  key={to}
                  size="s"
                  variant={DANGEROUS.includes(to) || to === "CIORNA" ? "text" : "secondary"}
                  disabled={pending}
                  onClick={() => (DANGEROUS.includes(to) ? setConfirm(to) : void move(to))}
                >
                  {PLAN_STATUS_ACTION[to]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Lucrări">
        <div className="flex flex-col gap-4">
          {plan.items.length === 0 ? (
            <p className="text-corp text-discret">Nicio lucrare încă. Adăugați-le mai jos sau din odontogramă, cu un clic pe dinte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-corp">
                <caption className="sr-only">Lucrările planului, pe faze</caption>
                <thead>
                  <tr className="border-b border-linie text-left text-mic text-discret">
                    <th scope="col" className="py-2 pr-3 font-semibold">Dinte</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Lucrare</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Cant.</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Preț</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Reducere</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Total</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                    <th scope="col" className="py-2">
                      <span className="sr-only">Acțiuni</span>
                    </th>
                  </tr>
                </thead>
                {phases.map((ph) => (
                  <tbody key={ph}>
                    {phases.length > 1 && (
                      <tr>
                        <th scope="rowgroup" colSpan={8} className="pt-3 pb-1 text-left text-mic font-semibold text-discret">
                          Faza {ph}
                        </th>
                      </tr>
                    )}
                    {plan.items
                      .filter((i) => i.phase === ph)
                      .map((i) => (
                        <PlanItemRow key={i.id} patientId={patientId} planId={plan.id} item={i} services={services} canManage={editable} pricesEditable={pricesEditable} />
                      ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
          {totals}
        </div>
      </Panel>

      {editable && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Adăugați o lucrare" level={2}>
            <PlanItemForm patientId={patientId} planId={plan.id} services={services} pricesEditable={pricesEditable} />
          </Panel>
          <Panel title="Detaliile planului" level={2}>
            <form action={header.formAction} onSubmit={header.onSubmit} noValidate className="flex flex-col gap-4">
              {header.state && !header.state.ok && <ErrorSummary errors={header.errors} message={header.formError} idFor={(n) => `plan-${n}`} />}
              <input type="hidden" name="id" value={patientId} />
              <input type="hidden" name="planId" value={plan.id} />
              <TextField id="plan-title" label="Titlu" name="title" required maxLength={120} defaultValue={plan.title} error={header.errors?.title} />
              <Select
                id="plan-doctorId"
                label="Medicul"
                name="doctorId"
                optional
                defaultValue={plan.doctor?.id ?? ""}
                placeholder="Alegeți"
                options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                error={header.errors?.doctorId}
              />
              {pricesEditable ? (
                <TextField
                  id="plan-discount"
                  label="Reducere pe plan (lei)"
                  name="discount"
                  optional
                  inputMode="decimal"
                  defaultValue={plan.discount > 0 ? formatAmount(plan.discount) : undefined}
                  error={header.errors?.discount}
                  inputClassName="cifre text-right"
                />
              ) : (
                <input type="hidden" name="discount" value={formatAmount(plan.discount)} />
              )}
              <TextArea id="plan-notes" label="Observații" name="notes" optional rows={3} maxLength={5000} defaultValue={plan.notes ?? undefined} error={header.errors?.notes} />
              <div>
                <SubmitButton size="s" variant="secondary" pendingLabel="Se salvează">
                  Salvați detaliile
                </SubmitButton>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "ANULAT" ? "Anulați planul?" : "Marcați planul ca respins?"}
        description="Lucrările propuse sau acceptate devin anulate. Cele efectuate rămân. Planul nu se mai poate modifica."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Renunțați
            </Button>
            <Button variant="danger" loading={pending} onClick={() => confirm && void move(confirm)}>
              {confirm ? PLAN_STATUS_ACTION[confirm] : ""}
            </Button>
          </>
        }
      />
    </div>
  );
}
