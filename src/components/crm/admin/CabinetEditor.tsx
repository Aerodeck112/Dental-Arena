"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { TextField } from "@/components/ui/TextField";
import { deleteCabinetAction, saveCabinetAction } from "@/app/(crm)/crm/(app)/locatii/actions";
import { useActionForm } from "./use-action-form";

export type CabinetDTO = { id: string; name: string; sortOrder: number; active: boolean; usage: number };

/** The rooms (chairs) of a clinic: the calendar can show them as columns. */
export function CabinetEditor({ locationId, cabinets, readOnly = false }: { locationId: string; cabinets: CabinetDTO[]; readOnly?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {cabinets.length === 0 && <p className="text-corp text-discret">Niciun cabinet. Adăugați cabinetele ca să le puteți folosi în calendar.</p>}
      <ul className="flex flex-col divide-y divide-linie border-y border-linie">
        {cabinets.map((c) => (
          <CabinetRow key={c.id} locationId={locationId} cabinet={c} readOnly={readOnly} />
        ))}
      </ul>
      {!readOnly && <NewCabinet locationId={locationId} nextOrder={(cabinets.at(-1)?.sortOrder ?? 0) + 1} />}
    </div>
  );
}

function CabinetRow({ locationId, cabinet, readOnly }: { locationId: string; cabinet: CabinetDTO; readOnly: boolean }) {
  const save = useActionForm(saveCabinetAction);
  const del = useActionForm(deleteCabinetAction);
  const ids = (n: string) => `cabinet-${cabinet.id}-${n}`;
  return (
    <li className="flex flex-col gap-2 py-2">
      <form action={save.formAction} onSubmit={save.onSubmit} noValidate className="flex flex-wrap items-end gap-3">
        {(save.errors || save.formError) && <ErrorSummary className="w-full" errors={save.errors} message={save.formError} idFor={ids} />}
        <input type="hidden" name="id" value={cabinet.id} />
        <input type="hidden" name="locationId" value={locationId} />
        <TextField id={ids("name")} label="Nume" name="name" defaultValue={cabinet.name} disabled={readOnly} required className="w-48" error={save.errors?.name} />
        <TextField id={ids("sortOrder")} label="Ordinea" name="sortOrder" inputMode="numeric" defaultValue={String(cabinet.sortOrder)} disabled={readOnly} className="w-24" inputClassName="cifre" />
        <div className="pb-2">
          <Checkbox id={ids("active")} name="active" label="Activ" defaultChecked={cabinet.active} disabled={readOnly} />
        </div>
        {!readOnly && (
          <Button type="submit" variant="secondary" size="s" loading={save.pending}>
            Salvați
          </Button>
        )}
      </form>
      {!readOnly && (
        <form action={del.formAction} onSubmit={del.onSubmit}>
          <input type="hidden" name="id" value={cabinet.id} />
          <Button type="submit" variant="text" size="s" icon="x" loading={del.pending}>
            {cabinet.usage > 0 ? "Scoateți din uz (are programări sau ture)" : "Ștergeți cabinetul"}
          </Button>
          {del.formError && <span className="ml-2 text-mic text-carmin">{del.formError}</span>}
        </form>
      )}
    </li>
  );
}

function NewCabinet({ locationId, nextOrder }: { locationId: string; nextOrder: number }) {
  const [formKey, setFormKey] = useState(0);
  const save = useActionForm(saveCabinetAction, { onSuccess: () => setFormKey((k) => k + 1) });
  return (
    <form
      key={formKey}
      action={save.formAction}
      onSubmit={save.onSubmit}
      noValidate
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="active" value="on" />
      <input type="hidden" name="sortOrder" value={nextOrder} />
      <TextField id={`cabinet-nou-${locationId}`} label="Cabinet nou" name="name" placeholder="Cabinet 4" className="w-48" required error={save.errors?.name ?? (save.formError ? [save.formError] : undefined)} />
      <Button type="submit" variant="secondary" icon="plus" loading={save.pending}>
        Adăugați cabinetul
      </Button>
    </form>
  );
}
