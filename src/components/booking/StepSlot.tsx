"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SlotButton } from "@/components/ui/SlotButton";
import { WeekStrip, type WeekStripDay } from "@/components/ui/WeekStrip";
import { cn } from "@/lib/cn";
import { formatDateRo, formatPhone } from "@/lib/format";
import { addDaysISO, todayISO } from "@/lib/time";
import type { BookingOptions, DaySlots, Slot } from "@/server/scheduling/types";
import type { BookingState } from "./useBookingState";

type Load =
  | { kind: "loading"; slow: boolean }
  | { kind: "ready"; days: DaySlots[] }
  | { kind: "error"; message: string };

const SLOW_MS = 600;

/** The doctors who can see this reason at this clinic (category match; none = everybody). */
export function eligibleDoctors(options: BookingOptions, serviceId: string | null, locationId: string | null) {
  const categoryId = options.reasons.find((r) => r.serviceId === serviceId)?.categoryId ?? null;
  const anyForCategory = categoryId ? options.doctors.some((d) => d.categoryIds.includes(categoryId)) : false;
  return options.doctors.filter(
    (d) =>
      (!locationId || d.locationIds.includes(locationId)) &&
      (!categoryId || !anyForCategory || d.categoryIds.includes(categoryId)),
  );
}

function dayLabel(dateISO: string): string {
  // „lun. 6 oct.” → two lines „lun.” / „6 oct.”
  const [weekday, ...rest] = formatDateRo(dateISO, "weekday").split(" ");
  return `${weekday}\n${rest.join(" ")}`;
}

function DoctorChip({
  selected,
  onClick,
  photoPath,
  monogram,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  photoPath?: string | null;
  monogram?: string | null;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "apasat inline-flex min-h-control items-center gap-2 rounded-chip border py-1 pr-4 pl-1.5 text-control font-medium",
        "transition-[background-color,border-color,box-shadow] duration-[120ms] ease-filet",
        selected
          ? "border-cerneala bg-menta-pal text-cerneala shadow-[0_0_0_1px_var(--da-cerneala)]"
          : "border-linie-control bg-suprafata text-cerneala hover:border-cerneala",
        photoPath === undefined && "pl-4",
      )}
    >
      {photoPath ? (
        <Image src={photoPath} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full object-cover object-top" />
      ) : photoPath === null ? (
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-adancit text-mic font-semibold text-discret">
          {monogram ?? ""}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/**
 * Step 2 „Ziua și ora”: the doctor filter, a 14-day week strip (days without free slots are
 * disabled), and the free slots grouped under „Dimineața” and „După-amiaza”, from
 * `GET /api/public/slots`. „Nu găsesc o oră potrivită. Prefer să mă sunați.” opens the callback form.
 */
export function StepSlot({
  options,
  state,
  serviceId,
  onDoctor,
  onDay,
  onSlot,
  onSlowLoading,
  notice,
  reloadKey,
  callback,
}: {
  options: BookingOptions;
  state: BookingState;
  serviceId: string;
  onDoctor: (doctorId: string | null) => void;
  onDay: (dateISO: string) => void;
  onSlot: (slot: Slot | null, dateISO: string | null) => void;
  onSlowLoading: (slow: boolean) => void;
  /** E.g. „Ora de 10:30 tocmai a fost ocupată…”, shown above the slots. */
  notice: string | null;
  /** Changes force a fresh load (after a taken slot). */
  reloadKey: number;
  /** The callback form, shown when the visitor asks to be called. */
  callback: ReactNode;
}) {
  const clinic = options.clinics.find((c) => c.id === state.locationId) ?? null;
  const doctors = useMemo(() => eligibleDoctors(options, serviceId, state.locationId), [options, serviceId, state.locationId]);
  const today = todayISO();
  const lastDay = addDaysISO(today, Math.max(0, options.horizonDays));
  const windowDays = Math.max(1, options.maxDays);
  const [from, setFrom] = useState(() => {
    if (state.dateISO && state.dateISO > today && state.dateISO <= lastDay) {
      // Keep a remembered day inside the first window that contains it.
      let f = today;
      while (addDaysISO(f, windowDays) <= state.dateISO) f = addDaysISO(f, windowDays);
      return f;
    }
    return today;
  });
  const [load, setLoad] = useState<Load>({ kind: "loading", slow: false });
  const [showCallback, setShowCallback] = useState(false);
  const [retry, setRetry] = useState(0);
  const callbackRef = useRef<HTMLDivElement>(null);

  const query = useMemo(() => {
    if (!clinic) return null;
    const p = new URLSearchParams({ clinica: clinic.slug, serviciu: serviceId, de: from, zile: String(windowDays) });
    if (state.doctorId) p.set("medic", state.doctorId);
    return p.toString();
  }, [clinic, serviceId, from, windowDays, state.doctorId]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state for a new query
    setLoad({ kind: "loading", slow: false });
    const timer = window.setTimeout(() => {
      setLoad((l) => (l.kind === "loading" ? { kind: "loading", slow: true } : l));
      onSlowLoading(true);
    }, SLOW_MS);
    fetch(`/api/public/slots?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as DaySlots[] | { error?: string } | null;
        if (!res.ok || !Array.isArray(body)) {
          const message =
            res.status === 429
              ? "Ați cerut orele de prea multe ori. Așteptați un minut sau sunați-ne."
              : ((body && !Array.isArray(body) && body.error) || "Orele libere nu au putut fi încărcate.");
          setLoad({ kind: "error", message });
          return;
        }
        setLoad({ kind: "ready", days: body });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoad({ kind: "error", message: "Orele libere nu au putut fi încărcate. Verificați conexiunea la internet." });
      })
      .finally(() => {
        window.clearTimeout(timer);
        onSlowLoading(false);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, reloadKey, retry, onSlowLoading]);

  const days = load.kind === "ready" ? load.days : [];
  const firstFree = days.find((d) => d.slots.length > 0)?.dateISO ?? null;
  const activeDay =
    state.dateISO && days.some((d) => d.dateISO === state.dateISO && d.slots.length > 0) ? state.dateISO : firstFree;
  const daySlots = days.find((d) => d.dateISO === activeDay)?.slots ?? [];

  // A remembered or prefilled time that is no longer free is dropped, so it cannot be submitted.
  const selectedStillFree =
    !state.startsAt || load.kind !== "ready" || !state.dateISO || !days.some((d) => d.dateISO === state.dateISO)
      ? true
      : days.some((d) => d.slots.some((s) => s.startsAt === state.startsAt));
  useEffect(() => {
    if (!selectedStillFree) onSlot(null, null);
  }, [selectedStillFree, onSlot]);

  const stripDays: WeekStripDay[] = (load.kind === "ready" ? days : Array.from({ length: windowDays }, (_, i) => ({ dateISO: addDaysISO(from, i), slots: [] }))).map((d) => ({
    dateISO: d.dateISO,
    label: dayLabel(d.dateISO),
    disabled: load.kind !== "ready" || d.slots.length === 0,
  }));

  const morning = daySlots.filter((s) => s.period === "dimineata");
  const afternoon = daySlots.filter((s) => s.period === "dupa-amiaza");
  const canPrev = from > today;
  const canNext = addDaysISO(from, windowDays) <= lastDay;
  const noneInWindow = load.kind === "ready" && !firstFree;

  const openCallback = () => {
    setShowCallback(true);
    window.setTimeout(() => callbackRef.current?.querySelector<HTMLElement>("input:not([type=hidden])")?.focus(), 50);
  };

  const slotGroup = (title: string, list: Slot[]) =>
    list.length > 0 && (
      <div className="flex flex-col gap-3">
        <h3 className="text-mic font-semibold text-discret">{title}</h3>
        <div className="flex flex-wrap gap-2.5">
          {list.map((s) => (
            <SlotButton
              key={s.startsAt}
              time={s.localTime}
              selected={state.startsAt === s.startsAt}
              onClick={() => onSlot(s, activeDay)}
              aria-label={`${s.localTime}, ${activeDay ? formatDateRo(activeDay, "long") : ""}`}
            />
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-h2 text-cerneala">Când vă convine?</h2>

      {notice && (
        <p role="alert" className="rounded-panou border-l-4 border-carmin bg-carmin-pal px-4 py-3 text-corp text-cerneala">
          {notice}
        </p>
      )}

      {doctors.length > 1 && (
        <div className="flex flex-col gap-3">
          <p id="filtru-medic" className="text-mic font-semibold text-discret">
            Medic
          </p>
          <div role="group" aria-labelledby="filtru-medic" className="flex flex-wrap gap-2">
            <DoctorChip selected={!state.doctorId} onClick={() => onDoctor(null)}>
              Oricare medic
            </DoctorChip>
            {doctors.map((d) => (
              <DoctorChip key={d.id} selected={state.doctorId === d.id} onClick={() => onDoctor(d.id)} photoPath={d.photoPath} monogram={d.monogram}>
                {d.publicName}
              </DoctorChip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-mic font-semibold text-discret">Ziua</p>
          <div className="flex gap-1">
            <Button variant="text" size="s" icon="chevron-left" disabled={!canPrev} onClick={() => setFrom((f) => (addDaysISO(f, -windowDays) < today ? today : addDaysISO(f, -windowDays)))}>
              Zilele anterioare
            </Button>
            <Button variant="text" size="s" icon="chevron-right" iconEnd disabled={!canNext} onClick={() => setFrom((f) => addDaysISO(f, windowDays))}>
              Zilele următoare
            </Button>
          </div>
        </div>
        <WeekStrip days={stripDays} value={activeDay} onChange={onDay} label="Alegeți ziua" />
      </div>

      <div aria-live="polite" aria-busy={load.kind === "loading"} className="flex min-h-40 flex-col gap-6">
        {load.kind === "loading" && (
          <>
            <p className="sr-only">Căutăm orele libere.</p>
            <div aria-hidden="true" className="flex flex-wrap gap-2.5">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="h-control-l w-[5.5rem] rounded-control border border-dashed border-linie-control" />
              ))}
            </div>
          </>
        )}
        {load.kind === "error" && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-corp text-cerneala">
              {load.message}
              {clinic ? ` Puteți suna la ${clinic.shortName}, ${formatPhone(clinic.phone)}.` : ""}
            </p>
            <Button variant="secondary" icon="refresh-cw" onClick={() => setRetry((n) => n + 1)}>
              Încercați din nou
            </Button>
          </div>
        )}
        {noneInWindow && clinic && (
          <div className="flex flex-col items-start gap-3 rounded-panou border border-dashed border-linie-control px-5 py-6">
            <p className="text-corp text-cerneala masura">
              Nu mai sunt ore libere în aceste zile la {clinic.shortName}. {canNext ? "Vedeți zilele următoare sau sunați" : "Sunați"} la{" "}
              <span className="telefon">{formatPhone(clinic.phone)}</span>.
            </p>
            {canNext && (
              <Button variant="secondary" onClick={() => setFrom((f) => addDaysISO(f, windowDays))}>
                Vedeți zilele următoare
              </Button>
            )}
          </div>
        )}
        {load.kind === "ready" && !noneInWindow && (
          <>
            {activeDay && <p className="text-corp text-cerneala">{formatDateRo(activeDay, "long").replace(/^./, (c) => c.toUpperCase())}</p>}
            {slotGroup("Dimineața", morning)}
            {slotGroup("După-amiaza", afternoon)}
          </>
        )}
      </div>

      <div ref={callbackRef} className="flex flex-col gap-4">
        {!showCallback ? (
          <p className="text-corp">
            Nu găsesc o oră potrivită.{" "}
            <button type="button" onClick={openCallback} className="cursor-pointer font-medium text-link underline underline-offset-4 hover:decoration-2">
              Prefer să mă sunați.
            </button>
          </p>
        ) : (
          callback
        )}
      </div>
    </div>
  );
}
