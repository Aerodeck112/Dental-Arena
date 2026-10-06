"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import type { PriceUnit } from "@/generated/prisma/enums";
import { PRICE_UNIT_LABEL } from "@/lib/labels";
import { formatPriceText } from "@/server/catalog/price";
import { deleteServiceAction, saveServiceAction } from "@/app/(crm)/crm/(app)/servicii/actions";
import { PriceInput } from "./PriceInput";
import { useActionForm } from "./use-action-form";

export type ServiceDTO = {
  id: string;
  categoryId: string;
  code: string | null;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  priceFrom: boolean;
  unit: PriceUnit;
  durationMinutes: number;
  bookableOnline: boolean;
  onlineLabel: string | null;
  onlineHint: string | null;
  urgent: boolean;
  isRepresentative: boolean;
  toothSpecific: boolean;
  recallMonths: number | null;
  publicVisible: boolean;
  active: boolean;
  sortOrder: number;
  usage: number;
};

const UNIT_OPTIONS = (Object.keys(PRICE_UNIT_LABEL) as PriceUnit[]).map((u) => ({
  value: u,
  label: u === "ACT" ? "pe act (implicit)" : `pe ${PRICE_UNIT_LABEL[u]}`,
}));

/**
 * One price item: name, code, price („1.200”, „900 / 1.100”, „de la 200”), unit, duration, online
 * booking (with the label shown in step 1 of /programare), the representative flag (exactly one per
 * category, shown on the home index), tooth-specific, urgent, recall months and visibility.
 */
export function ServiceEditor({
  service,
  categories,
  defaultCategoryId,
  readOnly = false,
}: {
  service?: ServiceDTO;
  categories: { id: string; name: string }[];
  defaultCategoryId?: string;
  readOnly?: boolean;
}) {
  const [unit, setUnit] = useState<PriceUnit>(service?.unit ?? "ACT");
  const [online, setOnline] = useState(service?.bookableOnline ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useActionForm(saveServiceAction);
  const del = useActionForm(deleteServiceAction, { toast: false });
  const e = save.errors;
  const ids = (n: string) => `serviciu-${n}`;

  return (
    <div className="flex flex-col gap-4">
      <form action={save.formAction} onSubmit={save.onSubmit} noValidate className="flex flex-col gap-6">
        {(e || save.formError) && <ErrorSummary errors={e} message={save.formError} idFor={(n) => (["price", "isRepresentative", "active", "bookableOnline"].includes(n) ? `field-${n}` : ids(n))} />}
        {service && <input type="hidden" name="id" value={service.id} />}
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
          <legend className="sr-only">Serviciu</legend>
          <section aria-labelledby="serviciu-baza" className="flex flex-col gap-4">
            <h2 id="serviciu-baza" className="text-h3 font-semibold">
              Denumire și preț
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField id={ids("name")} label="Denumire" name="name" required defaultValue={service?.name} maxLength={120} error={e?.name} />
              <Select
                id={ids("categoryId")}
                label="Categoria"
                name="categoryId"
                defaultValue={service?.categoryId ?? defaultCategoryId ?? ""}
                placeholder="Alegeți categoria"
                required
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                error={e?.categoryId}
              />
              <PriceInput
                defaultValue={service ? formatPriceText(service) : ""}
                unit={unit}
                error={e?.price}
                disabled={readOnly}
              />
              <Select
                id={ids("unit")}
                label="Unitatea de preț"
                name="unit"
                value={unit}
                onChange={(ev) => setUnit(ev.target.value as PriceUnit)}
                options={UNIT_OPTIONS}
                hint="Apare după preț, de exemplu 150 lei / oră."
                error={e?.unit}
              />
              <TextField
                id={ids("code")}
                label="Cod intern"
                name="code"
                optional
                defaultValue={service?.code ?? ""}
                hint="Majuscule și cratimă, de exemplu IMP-NEODENT."
                error={e?.code}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  id={ids("durationMinutes")}
                  label="Durata (minute)"
                  name="durationMinutes"
                  inputMode="numeric"
                  required
                  defaultValue={String(service?.durationMinutes ?? 30)}
                  hint="Multiplu de 5."
                  error={e?.durationMinutes}
                  inputClassName="cifre"
                />
                <TextField
                  id={ids("sortOrder")}
                  label="Ordinea în listă"
                  name="sortOrder"
                  inputMode="numeric"
                  defaultValue={String(service?.sortOrder ?? 0)}
                  hint="Mai mic, mai sus."
                  error={e?.sortOrder}
                  inputClassName="cifre"
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="serviciu-online" className="flex flex-col gap-3 border-t border-linie pt-5">
            <h2 id="serviciu-online" className="text-h3 font-semibold">
              Programare online
            </h2>
            <Checkbox
              name="bookableOnline"
              label="Se poate programa online"
              description="Apare ca motiv în primul pas al programării de pe site."
              checked={online}
              onChange={(ev) => setOnline(ev.target.checked)}
            />
            {online && (
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  id={ids("onlineLabel")}
                  label="Eticheta din programare"
                  name="onlineLabel"
                  required
                  maxLength={80}
                  defaultValue={service?.onlineLabel ?? ""}
                  hint="Cum îl alege pacientul, de exemplu Igienizare (detartraj)."
                  error={e?.onlineLabel}
                />
                <TextField
                  id={ids("onlineHint")}
                  label="Explicație scurtă"
                  name="onlineHint"
                  optional
                  maxLength={200}
                  defaultValue={service?.onlineHint ?? ""}
                  hint="Apare sub etichetă, în pasul 1."
                  error={e?.onlineHint}
                />
              </div>
            )}
            {!online && service?.onlineLabel && <input type="hidden" name="onlineLabel" value={service.onlineLabel} />}
            {!online && service?.onlineHint && <input type="hidden" name="onlineHint" value={service.onlineHint} />}
            <Checkbox
              name="urgent"
              label="Urgență („Am o durere acum”)"
              description="Programarea online afișează telefoanele clinicilor în loc de ore."
              defaultChecked={service?.urgent ?? false}
            />
          </section>

          <section aria-labelledby="serviciu-afisare" className="flex flex-col gap-3 border-t border-linie pt-5">
            <h2 id="serviciu-afisare" className="text-h3 font-semibold">
              Afișare și tratament
            </h2>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <Checkbox name="publicVisible" label="Apare în listele de prețuri de pe site" defaultChecked={service?.publicVisible ?? true} />
              <Checkbox
                name="isRepresentative"
                label="Preț reprezentativ al categoriei"
                description="Prețul afișat pe pagina de acasă. Fiecare categorie are exact unul; alegerea lui îl debifează pe cel vechi."
                defaultChecked={service?.isRepresentative ?? false}
                error={e?.isRepresentative}
              />
              <Checkbox
                name="toothSpecific"
                label="Se face pe dinte"
                description="În planul de tratament cere numărul dintelui."
                defaultChecked={service?.toothSpecific ?? false}
              />
              <Checkbox
                name="active"
                label="Activ"
                description="Un serviciu inactiv nu mai apare la programări, în planuri și pe facturi noi."
                defaultChecked={service?.active ?? true}
              />
            </div>
            <TextField
              id={ids("recallMonths")}
              label="Rechemare după (luni)"
              name="recallMonths"
              optional
              inputMode="numeric"
              defaultValue={service?.recallMonths ? String(service.recallMonths) : ""}
              hint="După o programare finalizată se creează automat o rechemare, de exemplu 6 la igienizare."
              className="max-w-xs"
              error={e?.recallMonths}
              inputClassName="cifre"
            />
          </section>
        </fieldset>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 border-t border-linie pt-4">
            <SubmitButton icon="check" pendingLabel="Se salvează">
              {service ? "Salvați serviciul" : "Adăugați serviciul"}
            </SubmitButton>
            {service && (
              <Button type="button" variant="text" icon="x" className="ml-auto" onClick={() => setConfirmDelete(true)}>
                {service.usage > 0 ? "Scoateți din uz" : "Ștergeți serviciul"}
              </Button>
            )}
          </div>
        )}
      </form>
      {service && (
        <Dialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          size="s"
          title={service.usage > 0 ? "Scoateți serviciul din uz" : "Ștergeți serviciul"}
          description={
            service.usage > 0
              ? "Serviciul apare în programări, planuri sau facturi, așa că se dezactivează: rămâne în istoric, dar nu mai poate fi ales și dispare de pe site."
              : "Serviciul nu a fost folosit nicăieri și se șterge definitiv."
          }
          footer={
            <>
              <Button type="button" variant="text" onClick={() => setConfirmDelete(false)}>
                Renunțați
              </Button>
              <form action={del.formAction} onSubmit={del.onSubmit}>
                <input type="hidden" name="id" value={service.id} />
                <Button type="submit" variant="danger" loading={del.pending}>
                  {service.usage > 0 ? "Dezactivați" : "Ștergeți"}
                </Button>
              </form>
            </>
          }
        >
          {del.formError && <p className="text-corp text-carmin">{del.formError}</p>}
        </Dialog>
      )}
    </div>
  );
}
