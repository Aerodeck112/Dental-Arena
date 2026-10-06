"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TimeInput } from "@/components/ui/TimeInput";
import { showToast, Toaster } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";
import { minutesToHHMM } from "@/lib/time";
import type { ScheduleEditorData, ShiftDTO } from "@/server/scheduling/schedules";
import { confirmScheduleAction, deleteShiftAction, saveShiftAction } from "@/app/(crm)/crm/(app)/echipa/[id]/program/actions";
import { rangeLabel, ShiftRow, WEEKDAYS } from "./ShiftRow";

type Draft = {
  id?: string;
  locationId: string;
  cabinetId: string;
  weekday: string;
  start: string;
  end: string;
  onlineBooking: boolean;
  validFrom: string;
  validUntil: string;
  breaks: { key: number; start: string; end: string }[];
};

let breakKey = 1;

function draftOf(shift: ShiftDTO | null, locationId: string, weekday = 1): Draft {
  if (!shift) {
    return {
      locationId,
      cabinetId: "",
      weekday: String(weekday),
      start: "09:00",
      end: "17:00",
      onlineBooking: true,
      validFrom: "",
      validUntil: "",
      breaks: [],
    };
  }
  return {
    id: shift.id,
    locationId: shift.locationId,
    cabinetId: shift.cabinetId ?? "",
    weekday: String(shift.weekday),
    start: minutesToHHMM(shift.startMinute),
    end: minutesToHHMM(shift.endMinute),
    onlineBooking: shift.onlineBooking,
    validFrom: shift.validFrom ?? "",
    validUntil: shift.validUntil ?? "",
    breaks: shift.breaks.map((b) => ({ key: breakKey++, start: minutesToHHMM(b.startMinute), end: minutesToHHMM(b.endMinute) })),
  };
}

function ShiftForm({
  data,
  draft,
  setDraft,
  onDone,
  onCancel,
}: {
  data: ScheduleEditorData;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(async (prev, fd) => {
    const r = await saveShiftAction(prev, fd);
    if (r.ok) {
      showToast({ kind: "success", message: r.message ?? "Programul a fost salvat." });
      onDone();
    }
    return r;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const location = data.locations.find((l) => l.id === draft.locationId);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <form action={action} onSubmit={(e) => {
        // Keep the visitor's ticks and choices: React resets a form after an `action` submit.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={errors ? null : state.error} />}
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="doctorId" value={data.doctor.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Clinica"
          name="locationId"
          required
          value={draft.locationId}
          onChange={(e) => set({ locationId: e.target.value, cabinetId: "" })}
          options={data.locations.map((l) => ({ value: l.id, label: l.shortName }))}
          error={errors?.locationId}
        />
        <Select
          label="Ziua"
          name="weekday"
          required
          value={draft.weekday}
          onChange={(e) => set({ weekday: e.target.value })}
          options={WEEKDAYS.map((w, i) => ({ value: String(i + 1), label: w }))}
          error={errors?.weekday}
        />
        <TimeInput label="De la" name="start" required step={300} value={draft.start} onChange={(e) => set({ start: e.target.value })} error={errors?.start} />
        <TimeInput label="Până la" name="end" required step={300} value={draft.end} onChange={(e) => set({ end: e.target.value })} error={errors?.end} />
        <Select
          label="Cabinet"
          name="cabinetId"
          value={draft.cabinetId}
          onChange={(e) => set({ cabinetId: e.target.value })}
          placeholder="Oricare cabinet"
          options={(location?.cabinets ?? []).map((c) => ({ value: c.id, label: c.name }))}
          hint="Cu un cabinet fix, nimeni altcineva nu poate fi programat în el în acest interval."
          error={errors?.cabinetId}
          className="sm:col-span-2"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-control font-medium text-cerneala">Pauze</legend>
        {errors?.breaks && <p className="text-mic font-medium text-carmin">{errors.breaks.join(" ")}</p>}
        {draft.breaks.length === 0 && <p className="text-mic text-discret">Fără pauză.</p>}
        {draft.breaks.map((b, i) => (
          <div key={b.key} className="flex flex-wrap items-end gap-3">
            <TimeInput
              id={`pauza-start-${b.key}`}
              label={`Pauza ${i + 1}, de la`}
              name="breakStart"
              step={300}
              value={b.start}
              onChange={(e) => set({ breaks: draft.breaks.map((x) => (x.key === b.key ? { ...x, start: e.target.value } : x)) })}
            />
            <TimeInput
              id={`pauza-end-${b.key}`}
              label="până la"
              name="breakEnd"
              step={300}
              value={b.end}
              onChange={(e) => set({ breaks: draft.breaks.map((x) => (x.key === b.key ? { ...x, end: e.target.value } : x)) })}
            />
            <Button variant="text" size="s" icon="x" onClick={() => set({ breaks: draft.breaks.filter((x) => x.key !== b.key) })}>
              Scoateți pauza
            </Button>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="s" icon="plus" onClick={() => set({ breaks: [...draft.breaks, { key: breakKey++, start: "12:00", end: "12:30" }] })}>
            Adăugați o pauză
          </Button>
        </div>
      </fieldset>

      <Checkbox
        name="onlineBooking"
        label="Intervalul apare în programarea online"
        description="Debifați pentru orele pe care le dați doar la telefon sau la recepție."
        checked={draft.onlineBooking}
        onChange={(e) => set({ onlineBooking: e.target.checked })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <DateInput label="Valabil de la" name="validFrom" optional value={draft.validFrom} onChange={(e) => set({ validFrom: e.target.value })} error={errors?.validFrom} />
        <DateInput
          label="Valabil până la (inclusiv)"
          name="validUntil"
          optional
          value={draft.validUntil}
          onChange={(e) => set({ validUntil: e.target.value })}
          error={errors?.validUntil}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="text" onClick={onCancel}>
          Renunțați
        </Button>
        <SubmitButton pendingLabel="Se salvează">Salvați intervalul</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Weekly shifts of one doctor per clinic (docs/architecture.md §4.2, WP4 „Schedule editor”):
 * hours, breaks, cabinet, online flag and validity. ADMIN edits; everybody else reads. Overlaps
 * with the doctor's other shifts, or with another doctor's shift in the same cabinet, are refused
 * by the server with a message that names the clash.
 */
export function ScheduleEditor({ data, canManage }: { data: ScheduleEditorData; canManage: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<ShiftDTO | null>(null);
  const [pending, startTransition] = useTransition();
  const cabinetName = (id: string | null) =>
    id ? (data.locations.flatMap((l) => l.cabinets).find((c) => c.id === id)?.name ?? null) : null;

  const remove = (shift: ShiftDTO) =>
    startTransition(async () => {
      const r = await deleteShiftAction({ id: shift.id });
      showToast(r.ok ? { kind: "success", message: r.message ?? "Intervalul a fost șters." } : { kind: "error", message: r.error });
      setToDelete(null);
    });

  const confirmDemo = () =>
    startTransition(async () => {
      const r = await confirmScheduleAction({ doctorId: data.doctor.id });
      showToast(r.ok ? { kind: "success", message: r.message ?? "Programul a fost confirmat." } : { kind: "error", message: r.error });
    });

  return (
    <div className="flex flex-col gap-4">
      <Toaster />
      {data.isDemo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panou bg-menta-pal px-4 py-3">
          <p className="text-corp text-cerneala">
            Program demonstrativ. Verificați orele cu medicul, apoi modificați-le sau confirmați programul.
          </p>
          {canManage && (
            <Button size="s" variant="secondary" icon="check" loading={pending} onClick={confirmDemo}>
              Confirmați programul
            </Button>
          )}
        </div>
      )}
      {!data.doctor.acceptsOnlineBooking && (
        <p className="text-corp text-discret">Medicul nu primește programări online; intervalele de mai jos se folosesc doar în calendar.</p>
      )}

      {data.locations.map((l) => {
        const shifts = data.shifts.filter((s) => s.locationId === l.id).sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
        return (
          <Panel
            key={l.id}
            title={l.shortName}
            actions={
              canManage && (
                <Button size="s" variant="secondary" icon="plus" onClick={() => setDraft(draftOf(null, l.id))}>
                  Adăugați un interval
                </Button>
              )
            }
          >
            {shifts.length === 0 ? (
              <p className="text-corp text-discret">Nu lucrează la {l.shortName}.</p>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[44rem] text-mic">
                  <caption className="sr-only">Programul săptămânal la {l.shortName}</caption>
                  <thead>
                    <tr className="border-b border-linie text-left text-discret">
                      <th scope="col" className="py-2 pr-4 font-medium">Ziua</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Interval</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Pauze</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Cabinet</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Programare</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Valabilitate</th>
                      {canManage && (
                        <th scope="col" className="py-2">
                          <span className="sr-only">Acțiuni</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => (
                      <ShiftRow
                        key={s.id}
                        shift={s}
                        cabinetName={cabinetName(s.cabinetId)}
                        canManage={canManage}
                        onEdit={() => setDraft(draftOf(s, l.id))}
                        onDelete={() => setToDelete(s)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })}

      {draft && (
        <Dialog
          open
          onClose={() => setDraft(null)}
          title={draft.id ? "Modificați intervalul" : "Interval nou"}
          description={data.doctor.publicName}
          size="l"
        >
          <ShiftForm data={data} draft={draft} setDraft={setDraft} onDone={() => setDraft(null)} onCancel={() => setDraft(null)} />
        </Dialog>
      )}

      {toDelete && (
        <Dialog
          open
          onClose={() => setToDelete(null)}
          title="Ștergeți intervalul?"
          description={`${WEEKDAYS[toDelete.weekday - 1]}, ${rangeLabel(toDelete.startMinute, toDelete.endMinute)}. Programările deja făcute rămân; orele nu mai sunt oferite.`}
          size="s"
          footer={
            <>
              <Button variant="text" onClick={() => setToDelete(null)}>
                Păstrați
              </Button>
              <Button variant="danger" loading={pending} onClick={() => remove(toDelete)}>
                Ștergeți intervalul
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
