"use client";

import { useState } from "react";
import { deletePlanItemAction, savePlanItemAction, setPlanItemStatusAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/planuri/actions";
import { runPatientAction, usePatientAction } from "@/components/crm/patients/use-patient-action";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { inputClasses } from "@/components/ui/field-styles";
import { Icon } from "@/components/ui/Icon";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import type { PlanItemStatus } from "@/generated/prisma/enums";
import { formatAmount, formatDateRo, formatLei } from "@/lib/format";
import { PLAN_ITEM_STATUS_LABEL } from "@/lib/labels";
import { ITEM_TRANSITIONS } from "@/server/patients/plan-math";
import type { PlanItemDTO } from "@/server/patients/types";

export type PlanService = { id: string; code: string | null; name: string; category: string; price: number | null; toothSpecific: boolean };

/** Catalog services grouped by category, with the list price; styled like the kit's Select. */
export function GroupedServiceSelect({
  id,
  value,
  onChange,
  services,
  emptyLabel,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  services: PlanService[];
  emptyLabel: string;
  describedBy?: string;
}) {
  const byCategory = new Map<string, PlanService[]>();
  for (const s of services) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  return (
    <span className="relative block">
      <select
        id={id}
        name="serviceId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        className={inputClasses("h-control cursor-pointer appearance-none pr-11")}
      >
        <option value="">{emptyLabel}</option>
        {[...byCategory.entries()].map(([cat, list]) => (
          <optgroup key={cat} label={cat}>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.price !== null ? `, ${formatLei(s.price)}` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <Icon name="chevron-down" size={20} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-discret" />
    </span>
  );
}

const STATUS_TONE: Record<PlanItemStatus, string> = {
  PROPUS: "border-dashed border-discret text-cerneala",
  ACCEPTAT: "border-actiune bg-menta-pal text-cerneala",
  PROGRAMAT: "border-actiune bg-menta-pal text-cerneala",
  EFECTUAT: "border-transparent bg-adancit text-discret",
  ANULAT: "border-dashed border-linie-control text-discret line-through",
};

/** Plan line status as a chip: edge and fill differ, never colour alone. */
export function PlanItemStatusChip({ status }: { status: PlanItemStatus }) {
  return <span className={`inline-flex items-center rounded-chip border px-2 py-0.5 text-mic whitespace-nowrap ${STATUS_TONE[status]}`}>{PLAN_ITEM_STATUS_LABEL[status]}</span>;
}

/** Add or edit a line: service from the catalog (price copied when left empty), tooth, phase, quantity, discount. */
export function PlanItemForm({
  patientId,
  planId,
  services,
  item,
  pricesEditable,
  onDone,
}: {
  patientId: string;
  planId: string;
  services: PlanService[];
  item?: PlanItemDTO;
  pricesEditable: boolean;
  onDone?: () => void;
}) {
  const [serviceId, setServiceId] = useState(item?.serviceId ?? "");
  const [key, setKey] = useState(0);
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(savePlanItemAction, {
    onSuccess: () => {
      setKey((k) => k + 1);
      setServiceId("");
      onDone?.();
    },
  });
  const service = services.find((s) => s.id === serviceId);
  const pfx = item ? `item-${item.id}` : "item-nou";
  /** After acceptance an existing line keeps its price; new lines may still be priced. */
  const locked = Boolean(item) && !pricesEditable;

  return (
    <form key={key} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} idFor={(n) => `${pfx}-${n}`} />}
      <input type="hidden" name="id" value={patientId} />
      <input type="hidden" name="planId" value={planId} />
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${pfx}-serviceId`} className="text-control font-semibold text-cerneala">
          Serviciul <span className="font-normal text-discret">(opțional)</span>
        </label>
        <GroupedServiceSelect id={`${pfx}-serviceId`} value={serviceId} onChange={setServiceId} services={services} emptyLabel="Fără serviciu din listă (descrieți lucrarea)" />
        {errors?.serviceId && <p className="text-mic text-carmin">{errors.serviceId.join(" ")}</p>}
      </div>
      <TextField
        id={`${pfx}-description`}
        label="Descriere"
        name="description"
        optional
        maxLength={200}
        defaultValue={item?.description}
        hint={service ? `Implicit „${service.name}”.` : "De exemplu „Radiografie panoramică”."}
        error={errors?.description}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField id={`${pfx}-tooth`} label="Dintele" name="tooth" placeholder="36" inputMode="numeric" maxLength={2} defaultValue={item?.tooth ?? undefined} error={errors?.tooth} inputClassName="cifre" />
        <TextField id={`${pfx}-surfaces`} label="Suprafețe" name="surfaces" maxLength={6} placeholder="MOD" defaultValue={item?.surfaces ?? undefined} error={errors?.surfaces} />
        <TextField id={`${pfx}-phase`} label="Faza" name="phase" inputMode="numeric" maxLength={1} defaultValue={String(item?.phase ?? 1)} error={errors?.phase} inputClassName="cifre" />
        <TextField id={`${pfx}-quantity`} label="Cantitate" name="quantity" inputMode="numeric" maxLength={2} defaultValue={String(item?.quantity ?? 1)} disabled={locked} error={errors?.quantity} inputClassName="cifre" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${pfx}-unitPrice`}
          label="Preț unitar (lei)"
          name="unitPrice"
          optional
          inputMode="decimal"
          defaultValue={item ? formatAmount(item.unitPrice) : undefined}
          disabled={locked}
          hint={item ? undefined : service?.price != null ? `Gol: ${formatLei(service.price)}, din listă.` : "Gol: prețul din listă."}
          error={errors?.unitPrice}
          inputClassName="cifre text-right"
        />
        <TextField
          id={`${pfx}-discount`}
          label="Reducere (lei)"
          name="discount"
          optional
          inputMode="decimal"
          defaultValue={item && item.discount > 0 ? formatAmount(item.discount) : undefined}
          disabled={locked}
          error={errors?.discount}
          inputClassName="cifre text-right"
        />
      </div>
      {locked && item && (
        <>
          <input type="hidden" name="quantity" value={item.quantity} />
          <input type="hidden" name="unitPrice" value={formatAmount(item.unitPrice)} />
          <input type="hidden" name="discount" value={formatAmount(item.discount)} />
          <p className="text-mic text-discret">Prețurile nu se mai schimbă după ce pacientul a acceptat planul.</p>
        </>
      )}
      <div>
        <SubmitButton icon={item ? "check" : "plus"} pendingLabel="Se salvează">
          {item ? "Salvați lucrarea" : "Adăugați lucrarea"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** One line of the plan: tooth, work, quantity, price, discount, total, status and actions. */
export function PlanItemRow({
  patientId,
  planId,
  item,
  services,
  canManage,
  pricesEditable,
}: {
  patientId: string;
  planId: string;
  item: PlanItemDTO;
  services: PlanService[];
  canManage: boolean;
  pricesEditable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const next = ITEM_TRANSITIONS[item.status];
  return (
    <tr className="border-b border-linie align-top">
      <td className="cifre py-2 pr-3 whitespace-nowrap">
        {item.tooth ?? "–"}
        {item.surfaces ? <span className="text-discret"> {item.surfaces}</span> : null}
      </td>
      <td className="py-2 pr-3">
        <span className={item.status === "ANULAT" ? "text-discret line-through" : "text-cerneala"}>{item.description}</span>
        {item.performedAt && <span className="block text-mic text-discret">Efectuat {formatDateRo(item.performedAt, "short")}</span>}
      </td>
      <td className="cifre py-2 pr-3 text-right whitespace-nowrap">{item.quantity}</td>
      <td className="cifre py-2 pr-3 text-right whitespace-nowrap">{formatLei(item.unitPrice)}</td>
      <td className="cifre py-2 pr-3 text-right whitespace-nowrap">{item.discount > 0 ? `− ${formatLei(item.discount)}` : "–"}</td>
      <td className="cifre py-2 pr-3 text-right font-semibold whitespace-nowrap">{formatLei(item.total)}</td>
      <td className="py-2 pr-3">
        {canManage && next.length > 0 ? (
          <Select
            label={`Statusul lucrării ${item.description}`}
            hideLabel
            name={`status-${item.id}`}
            id={`status-${item.id}`}
            value={item.status}
            onChange={(e) =>
              void runPatientAction(setPlanItemStatusAction({ id: patientId, planId, itemId: item.id, status: e.target.value as PlanItemStatus }))
            }
            options={[item.status, ...next].map((s) => ({ value: s, label: PLAN_ITEM_STATUS_LABEL[s] }))}
            inputClassName="h-control-s min-w-32"
          />
        ) : (
          <PlanItemStatusChip status={item.status} />
        )}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        {canManage && item.status !== "EFECTUAT" && item.status !== "ANULAT" && (
          <Button size="s" variant="text" icon="pencil" onClick={() => setEditing(true)} aria-label={`Modificați ${item.description}`} />
        )}
        {canManage && pricesEditable && (
          <Button
            size="s"
            variant="text"
            icon="x"
            aria-label={`Ștergeți ${item.description}`}
            onClick={() => {
              if (window.confirm(`Ștergeți „${item.description}” din plan?`)) void runPatientAction(deletePlanItemAction({ id: patientId, planId, itemId: item.id }));
            }}
          />
        )}
        <Dialog open={editing} onClose={() => setEditing(false)} title="Modificați lucrarea" size="l">
          <PlanItemForm patientId={patientId} planId={planId} services={services} item={item} pricesEditable={pricesEditable} onDone={() => setEditing(false)} />
        </Dialog>
      </td>
    </tr>
  );
}
