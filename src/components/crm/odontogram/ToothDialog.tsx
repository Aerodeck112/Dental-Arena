"use client";

import { useState } from "react";
import { addConditionAction, addToothPlanItemAction, resolveConditionAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/odontograma/actions";
import { runPatientAction, usePatientAction } from "@/components/crm/patients/use-patient-action";
import { GroupedServiceSelect } from "@/components/crm/plans/PlanItemRow";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import type { ToothConditionType } from "@/generated/prisma/enums";
import { formatDateRo, formatLei } from "@/lib/format";
import { PLAN_STATUS_LABEL, TOOTH_CONDITION_LABEL } from "@/lib/labels";
import type { PlanStatus } from "@/generated/prisma/enums";
import type { ToothConditionDTO } from "@/server/patients/types";
import { surfaceLabel, surfacesFor, toothName } from "./fdi";
import { LEGEND, LEGEND_BY_CONDITION } from "./legend";

export type OdontogramService = { id: string; code: string | null; name: string; category: string; price: number | null; toothSpecific: boolean };
export type OdontogramPlan = { id: string; title: string; status: PlanStatus };

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  tooth: number;
  rows: ToothConditionDTO[];
  canEdit: boolean;
  canPlan: boolean;
  services: OdontogramService[];
  plans: OdontogramPlan[];
};

function SurfacePicker({ tooth, idPrefix }: { tooth: number; idPrefix: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-control font-semibold text-cerneala">
        Suprafețe <span className="font-normal text-discret">(opțional; fără bifă, tot dintele)</span>
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {surfacesFor(tooth).map((s) => (
          <Checkbox key={s} id={`${idPrefix}-${s}`} name="surfaces" value={s} label={`${s}, ${surfaceLabel(s, tooth).toLowerCase()}`} />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Clicking a tooth: its current findings (resolve one), „Adăugați o constatare”, and
 * „Adăugați în plan” with the price from the catalog (Prețuri).
 */
export function ToothDialog({ open, onClose, patientId, tooth, rows, canEdit, canPlan, services, plans }: Props) {
  const active = rows.filter((r) => !r.resolvedAt);
  const history = rows.filter((r) => r.resolvedAt);
  const [tab, setTab] = useState<"constatare" | "plan">("constatare");
  const [condition, setCondition] = useState<ToothConditionType>("CARIE");
  const [serviceId, setServiceId] = useState("");
  const [formKey, setFormKey] = useState(0);
  const cond = usePatientAction(addConditionAction, { onSuccess: () => setFormKey((k) => k + 1) });
  const plan = usePatientAction(addToothPlanItemAction, { onSuccess: () => setFormKey((k) => k + 1) });
  const service = services.find((s) => s.id === serviceId);

  return (
    <Dialog open={open} onClose={onClose} title={`Dintele ${tooth}`} description={toothName(tooth).replace(/^\d+, /, "")} size="l">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-h3 font-semibold text-cerneala">Constatări actuale</h3>
          {active.length === 0 ? (
            <p className="text-corp text-discret">Nicio constatare. Dintele este considerat sănătos.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-linie">
              {active.map((r) => {
                const l = LEGEND_BY_CONDITION[r.condition];
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-corp text-cerneala">
                      <span className="font-semibold">
                        {l.letter} · {TOOTH_CONDITION_LABEL[r.condition]}
                      </span>
                      {r.surfaces ? `, ${r.surfaces}` : ""}
                      <span className="block text-mic text-discret">
                        {formatDateRo(r.recordedAt, "short")}
                        {r.recordedBy ? `, ${r.recordedBy}` : ""}
                        {r.notes ? `. ${r.notes}` : ""}
                      </span>
                    </span>
                    {canEdit && (
                      <Button size="s" variant="text" onClick={() => runPatientAction(resolveConditionAction({ id: patientId, conditionId: r.id }))}>
                        Marcați rezolvată
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {history.length > 0 && (
            <details className="text-mic text-discret">
              <summary className="cursor-pointer text-link">Istoric ({history.length})</summary>
              <ul className="mt-1 flex flex-col gap-1">
                {history.map((r) => (
                  <li key={r.id}>
                    {TOOTH_CONDITION_LABEL[r.condition]}
                    {r.surfaces ? ` ${r.surfaces}` : ""}, {formatDateRo(r.recordedAt, "short")} – rezolvată {formatDateRo(r.resolvedAt as string, "short")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {(canEdit || canPlan) && (
          <div className="flex gap-2 border-b border-linie" role="tablist" aria-label="Ce adăugați">
            {canEdit && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "constatare"}
                onClick={() => setTab("constatare")}
                className={`-mb-px border-b-2 px-3 py-2 text-control ${tab === "constatare" ? "border-actiune font-semibold text-cerneala" : "border-transparent text-discret"}`}
              >
                Adăugați o constatare
              </button>
            )}
            {canPlan && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "plan" || !canEdit}
                onClick={() => setTab("plan")}
                className={`-mb-px border-b-2 px-3 py-2 text-control ${tab === "plan" || !canEdit ? "border-actiune font-semibold text-cerneala" : "border-transparent text-discret"}`}
              >
                Adăugați în plan
              </button>
            )}
          </div>
        )}

        {canEdit && tab === "constatare" && (
          <form key={`c${formKey}`} action={cond.formAction} onSubmit={cond.onSubmit} noValidate className="flex flex-col gap-4" role="tabpanel">
            {cond.state && !cond.state.ok && <ErrorSummary errors={cond.errors} message={cond.formError} />}
            <input type="hidden" name="id" value={patientId} />
            <input type="hidden" name="tooth" value={tooth} />
            <Select
              label="Constatarea"
              name="condition"
              id="odo-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as ToothConditionType)}
              options={LEGEND.map((l) => ({ value: l.condition, label: `${l.letter} · ${l.label}` }))}
              error={cond.errors?.condition}
            />
            {LEGEND_BY_CONDITION[condition].scope === "surface" && <SurfacePicker tooth={tooth} idPrefix="odo-c" />}
            <TextField label="Observații" name="notes" id="odo-notes" optional maxLength={500} error={cond.errors?.notes} />
            {active.length > 0 && (
              <Checkbox
                name="replaceExisting"
                id="odo-replace"
                label="Înlocuiește constatările actuale ale dintelui"
                description="De exemplu, caria tratată devine obturație. Cele vechi rămân în istoric."
              />
            )}
            <div>
              <SubmitButton icon="plus" pendingLabel="Se adaugă">
                Adăugați constatarea
              </SubmitButton>
            </div>
          </form>
        )}

        {canPlan && (tab === "plan" || !canEdit) && (
          <form key={`p${formKey}`} action={plan.formAction} onSubmit={plan.onSubmit} noValidate className="flex flex-col gap-4" role="tabpanel">
            {plan.state && !plan.state.ok && <ErrorSummary errors={plan.errors} message={plan.formError} />}
            <input type="hidden" name="id" value={patientId} />
            <input type="hidden" name="tooth" value={tooth} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="odo-service" className="text-control font-semibold text-cerneala">
                Lucrarea
              </label>
              <GroupedServiceSelect id="odo-service" value={serviceId} onChange={setServiceId} services={services} emptyLabel="Alegeți din prețuri" describedBy="odo-service-price" />
              <p id="odo-service-price" className="text-mic text-discret">
                {service
                  ? service.price !== null
                    ? `Preț din listă: ${formatLei(service.price)}. Îl puteți ajusta în plan.`
                    : "Serviciul nu are preț în listă: completați-l în plan."
                  : "Prețul se copiază din lista de prețuri."}
              </p>
              {plan.errors?.serviceId && <p className="text-mic text-carmin">{plan.errors.serviceId.join(" ")}</p>}
            </div>
            <SurfacePicker tooth={tooth} idPrefix="odo-p" />
            <Select
              label="În planul"
              name="planId"
              id="odo-plan"
              optional
              placeholder="Plan nou sau ciorna existentă"
              options={plans.map((p) => ({ value: p.id, label: `${p.title} (${PLAN_STATUS_LABEL[p.status].toLowerCase()})` }))}
              error={plan.errors?.planId}
            />
            <div>
              <SubmitButton icon="clipboard-list" pendingLabel="Se adaugă" disabled={!serviceId}>
                Adăugați în plan
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
