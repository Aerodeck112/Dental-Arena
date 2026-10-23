"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { inputClasses } from "@/components/ui/field-styles";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/time";
import { hoursProblems, type HoursRow } from "@/server/locations/schemas";
import { saveHoursAction } from "@/app/(crm)/crm/(app)/locatii/actions";
import { useActionForm } from "./use-action-form";

const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

type Interval = { key: string; weekday: number; open: string; close: string };

/**
 * Opening hours per weekday, with any number of intervals (for a lunch break, two). A day without
 * intervals is closed. Saved as a whole week; problems are checked here and on the server.
 */
export function HoursEditor({ locationId, hours, readOnly = false }: { locationId: string; hours: HoursRow[]; readOnly?: boolean }) {
  // Keys feed element ids, so the initial ones must match between server and client render.
  const [rows, setRows] = useState<Interval[]>(() =>
    hours.map((h, i) => ({ key: `h${i}`, weekday: h.weekday, open: minutesToHHMM(h.openMinute), close: minutesToHHMM(h.closeMinute) })),
  );
  const seq = useRef(hours.length);
  const nextKey = () => `h${seq.current++}`;
  const f = useActionForm(saveHoursAction);
  const parsed = rows.map((r) => ({ weekday: r.weekday, openMinute: hhmmToMinutes(r.open), closeMinute: hhmmToMinutes(r.close) }));
  const incomplete = parsed.some((p) => p.openMinute === null || p.closeMinute === null);
  const valid = parsed.filter((p): p is HoursRow => p.openMinute !== null && p.closeMinute !== null);
  const problems = [...(incomplete ? ["Completați ambele ore la fiecare interval, de exemplu 09:00 și 17:00."] : []), ...hoursProblems(valid)].map((p) =>
    p.replace(/^Ziua (\d)/, (_m, d: string) => DAYS[Number(d) - 1]),
  );
  const set = (key: string, patch: Partial<Interval>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={f.formAction} onSubmit={(e) => (problems.length ? e.preventDefault() : f.onSubmit(e))} noValidate className="flex flex-col gap-4">
      {(f.errors || f.formError) && <ErrorSummary errors={f.errors} message={f.formError} />}
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="hours" value={JSON.stringify(valid)} />
      <ul className="flex flex-col divide-y divide-linie border-y border-linie">
        {DAYS.map((day, i) => {
          const weekday = i + 1;
          const list = rows.filter((r) => r.weekday === weekday);
          return (
            <li key={day} className="grid gap-2 py-2 sm:grid-cols-[8rem_1fr] sm:items-start">
              <span className="pt-1.5 text-corp font-semibold">{day}</span>
              <div className="flex flex-col gap-2">
                {list.length === 0 && <span className="pt-1.5 text-corp text-discret">Închis</span>}
                {list.map((r, j) => (
                  <div key={r.key} className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`${r.key}-de`}>
                      {day}, intervalul {j + 1}, de la
                    </label>
                    <span className="block w-36">
                      <input
                        id={`${r.key}-de`}
                        type="time"
                        step={300}
                        disabled={readOnly}
                        value={r.open}
                        onChange={(e) => set(r.key, { open: e.target.value })}
                        className={inputClasses("h-control-s cifre")}
                      />
                    </span>
                    <span aria-hidden>–</span>
                    <label className="sr-only" htmlFor={`${r.key}-pana`}>
                      {day}, intervalul {j + 1}, până la
                    </label>
                    <span className="block w-36">
                      <input
                        id={`${r.key}-pana`}
                        type="time"
                        step={300}
                        disabled={readOnly}
                        value={r.close}
                        onChange={(e) => set(r.key, { close: e.target.value })}
                        className={inputClasses("h-control-s cifre")}
                      />
                    </span>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="text"
                        size="s"
                        icon="x"
                        aria-label={`Scoateți intervalul ${j + 1} de ${day.toLowerCase()}`}
                        onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                      />
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="text"
                      size="s"
                      icon="plus"
                      onClick={() => {
                        const last = list.at(-1);
                        setRows((prev) => [
                          ...prev,
                          { key: nextKey(), weekday, open: last ? last.close : "09:00", close: last ? "20:00" : "17:00" },
                        ]);
                      }}
                    >
                      Interval
                    </Button>
                    {weekday > 1 && list.length === 0 && rows.some((r) => r.weekday === weekday - 1) && (
                      <Button
                        type="button"
                        variant="text"
                        size="s"
                        icon="copy"
                        onClick={() =>
                          setRows((prev) => [
                            ...prev,
                            ...prev.filter((r) => r.weekday === weekday - 1).map((r) => ({ ...r, key: nextKey(), weekday })),
                          ])
                        }
                      >
                        Ca {DAYS[i - 1].toLowerCase()}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {problems.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-mic text-carmin" aria-live="polite">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <SubmitButton icon="check" pendingLabel="Se salvează" disabled={problems.length > 0}>
            Salvați programul
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
