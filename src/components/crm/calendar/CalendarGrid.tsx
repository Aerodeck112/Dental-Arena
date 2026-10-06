"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { moveAppointmentAction } from "@/app/(crm)/crm/(app)/programari/actions";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ConflictInfo } from "@/lib/errors";
import { minutesToHHMM } from "@/lib/time";
import type { AppointmentFormOptions, CalendarAppointment, CalendarColumn, CalendarData } from "@/server/appointments/types";
import { AppointmentBlock } from "./AppointmentBlock";
import { AppointmentDrawer } from "./AppointmentDrawer";
import { canOverrideAll } from "./ConflictNotice";
import { MoveDialog, announceMove, type MoveTarget } from "./MoveDialog";
import { NowLine, useNow } from "./NowLine";
import { QuickCreatePopover, type QuickSlot } from "./QuickCreatePopover";
import { TimeGutter } from "./TimeGutter";
import { PX_PER_MINUTE, SLOT_MINUTES, calendarHref, columnKeyOf, layoutLanes, minuteToY, yToSlotMinute } from "./layout";
import { useCalendarDrag, type DropTarget } from "./useCalendarDrag";

export type CalendarGridProps = {
  data: CalendarData;
  /** Null when the user may not create or move appointments. */
  options: AppointmentFormOptions | null;
  nowISO: string;
  /** The `clinica` URL parameter, kept on links. */
  clinica: string | null;
  /** Both clinics in scope: blocks name the clinic. */
  multiClinic: boolean;
};

const REFRESH_MS = 60_000;

/** Hour and quarter lines drawn as a background, so 15-minute rows cost no DOM. */
const gridLines = {
  backgroundImage: `linear-gradient(to bottom, var(--color-linie) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-linie) 45%, transparent) 1px, transparent 1px)`,
  backgroundSize: `100% ${60 * PX_PER_MINUTE}px, 100% ${SLOT_MINUTES * PX_PER_MINUTE}px`,
};

/**
 * The calendar body for the day view (one column per doctor or cabinet) and the week view (one
 * column per day, one doctor). 15-minute rows at 24 px, the now-line, blocks in lanes, drag to
 * move or resize (snapped, with a ghost), click on an empty slot for quick-create, the drawer and
 * the „Mutați” dialog. Arrow keys walk between blocks; Enter opens one.
 */
export function CalendarGrid({ data, options, nowISO, clinica, multiClinic }: CalendarGridProps) {
  const router = useRouter();
  const now = useNow(nowISO);
  const scroller = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ a: CalendarAppointment; target: MoveTarget | null } | null>(null);
  const [slot, setSlot] = useState<QuickSlot | null>(null);
  const [optimistic, setOptimistic] = useState<{ id: string; columnId: string; start: number; end: number } | null>(null);
  const { dayStart, dayEnd, columns } = data;
  const kind = columns[0]?.kind ?? "doctor";
  const isWeek = data.view === "saptamana";
  const height = minuteToY(dayEnd, dayStart);
  const refresh = useCallback(() => router.refresh(), [router]);

  // Reception keeps this open all day: refresh quietly every minute while visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !moving && !slot) refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh, moving, slot]);

  // Scroll to the now-line (today) or the first appointment, once per date.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const showsToday = columns.some((c) => c.dateISO === data.todayISO);
    const first = data.appointments.reduce((m, a) => Math.min(m, a.startMinute), Infinity);
    const target = showsToday ? data.nowMinute - 60 : Number.isFinite(first) ? first - 30 : dayStart;
    el.scrollTop = Math.max(0, minuteToY(target, dayStart));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.dateISO, data.view]);

  const byColumn = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const a of data.appointments) {
      const key = optimistic?.id === a.id ? optimistic.columnId : columnKeyOf(a, kind);
      const shown = optimistic?.id === a.id ? { ...a, startMinute: optimistic.start, endMinute: optimistic.end } : a;
      map.set(key, [...(map.get(key) ?? []), shown]);
    }
    return map;
  }, [data.appointments, kind, optimistic]);

  const selected = data.appointments.find((a) => a.id === selectedId) ?? null;
  const findColumn = (id: string) => columns.find((c) => c.id === id);

  // ── Drag and drop ──
  const onDrop = useCallback(
    async (t: DropTarget) => {
      const a = data.appointments.find((x) => x.id === t.id);
      const col = columns.find((c) => c.id === t.columnId);
      if (!a || !col) return;
      const target: MoveTarget = {
        date: col.kind === "day" ? col.dateISO : a.dateISO,
        startMinute: t.start,
        durationMinutes: t.end - t.start,
        doctorId: col.kind === "doctor" && col.doctorId ? col.doctorId : a.doctorId,
        cabinetId: col.kind === "cabinet" ? col.cabinetId : undefined,
      };
      setOptimistic({ id: a.id, columnId: t.columnId, start: t.start, end: t.end });
      const r = await moveAppointmentAction({
        id: a.id,
        expectedUpdatedAt: a.updatedAt,
        date: target.date,
        time: minutesToHHMM(target.startMinute),
        durationMinutes: target.durationMinutes,
        doctorId: target.doctorId,
        cabinetId: col.kind === "cabinet" ? (col.cabinetId ?? "none") : undefined,
        confirmed: false,
        acknowledgeWarnings: false,
        undo: false,
      });
      setOptimistic(null);
      if (r.ok) {
        announceMove(r, refresh);
        return;
      }
      const conflicts: ConflictInfo[] = r.code === "CONFLICT" ? (r.details?.conflicts ?? []) : [];
      if (conflicts.length > 0 && options && canOverrideAll(conflicts, { canOverride: options.canOverride, role: options.role })) {
        // Warnings only: the dialog shows them with „Salvați oricum”, prefilled with the drop.
        setMoving({ a, target });
        return;
      }
      showToast({ kind: "error", message: conflicts.find((c) => c.severity === "block")?.message ?? conflicts[0]?.message ?? r.error });
      if (r.code === "STALE") refresh();
    },
    [data.appointments, columns, options, refresh],
  );
  const { drag, startMove, startResize } = useCalendarDrag({ dayStart, dayEnd, onDrop });

  // ── Empty slot → quick-create ──
  const onColumnClick = (e: MouseEvent<HTMLDivElement>, col: CalendarColumn) => {
    if (!options || e.target !== e.currentTarget) return;
    if (options.forcedDoctorId && col.doctorId && col.doctorId !== options.forcedDoctorId) {
      showToast({ kind: "error", message: "Puteți crea programări doar în coloana dumneavoastră." });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = yToSlotMinute(e.clientY - rect.top, dayStart);
    if (minute >= dayEnd) return;
    setSelectedId(null);
    setSlot({
      columnId: col.id,
      columnLabel: col.label,
      date: col.dateISO,
      startMinute: minute,
      locationId: col.locationId,
      doctorId: col.doctorId ?? options.forcedDoctorId,
      cabinetId: col.cabinetId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // ── Keyboard: arrows walk between blocks ──
  const onBlockKey = (e: KeyboardEvent<HTMLButtonElement>, a: CalendarAppointment, colIndex: number) => {
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (e.key === "m" || e.key === "M") {
      if (a.canManage && (a.status === "PROGRAMAT" || a.status === "CONFIRMAT")) {
        e.preventDefault();
        setMoving({ a, target: null });
      }
      return;
    }
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const list = (id: string) => [...(byColumn.get(id) ?? [])].sort((x, y) => x.startMinute - y.startMinute);
    let next: CalendarAppointment | undefined;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const same = list(columns[colIndex].id);
      const i = same.findIndex((x) => x.id === a.id);
      next = same[i + (e.key === "ArrowDown" ? 1 : -1)];
    } else {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      for (let c = colIndex + dir; c >= 0 && c < columns.length && !next; c += dir) {
        const items = list(columns[c].id);
        next = items.reduce<CalendarAppointment | undefined>(
          (best, x) => (!best || Math.abs(x.startMinute - a.startMinute) < Math.abs(best.startMinute - a.startMinute) ? x : best),
          undefined,
        );
      }
    }
    if (next) scroller.current?.querySelector<HTMLButtonElement>(`[data-block="${next.id}"]`)?.focus();
  };

  const colMin = isWeek ? 128 : kind === "cabinet" ? 150 : 176;
  const ghostSource = drag?.active ? data.appointments.find((a) => a.id === drag.id) : undefined;

  if (columns.length === 0) {
    return (
      <div className="rounded-panou border border-linie bg-suprafata px-6 py-10 text-corp text-discret">
        {isWeek
          ? "Niciun medic nu are program în clinica aleasă. Alegeți altă clinică sau „Ambele”."
          : kind === "cabinet"
            ? "Clinica aleasă nu are cabinete active. Le puteți adăuga din Clinici."
            : "Niciun medic nu lucrează în această zi. Alegeți altă zi sau altă clinică."}
      </div>
    );
  }

  return (
    <>
      <div
        ref={scroller}
        className="relative max-h-[calc(100dvh-15rem)] min-h-[420px] overflow-auto rounded-panou border border-linie bg-suprafata"
        role="region"
        aria-label={`Calendar, ${data.title}`}
        tabIndex={-1}
      >
        <div className="flex min-w-max">
          <div className="sticky left-0 z-30 flex flex-col bg-suprafata">
            <div className="sticky top-0 z-30 h-12 w-14 border-b border-r border-linie bg-suprafata" />
            <TimeGutter dayStart={dayStart} dayEnd={dayEnd} />
          </div>
          {columns.map((col, colIndex) => {
            const items = byColumn.get(col.id) ?? [];
            const lanes = layoutLanes(items.map((a) => ({ id: a.id, start: a.startMinute, end: a.endMinute })));
            const isToday = col.dateISO === data.todayISO;
            const closed = closedRanges(col.open, dayStart, dayEnd);
            return (
              <div key={col.id} className="flex flex-1 flex-col border-r border-linie last:border-r-0" style={{ minWidth: colMin }}>
                <ColumnHeader col={col} isToday={isToday} isWeek={isWeek} count={items.filter((a) => a.status !== "ANULAT").length} clinica={clinica} />
                <div
                  data-column-id={col.id}
                  onClick={(e) => onColumnClick(e, col)}
                  className={cn("relative", options && "cursor-cell")}
                  style={{ height, ...gridLines }}
                >
                  {closed.map(([s, e]) => (
                    <div
                      key={`c${s}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bg-adancit/70"
                      style={{ top: minuteToY(s, dayStart), height: minuteToY(e, s) }}
                    />
                  ))}
                  {[...col.breaks, ...col.timeOff].map((b, i) => (
                    <div
                      key={`b${i}`}
                      className="pointer-events-none absolute inset-x-0 overflow-hidden border-y border-linie-control/60 px-2 pt-0.5 text-micro text-discret"
                      style={{
                        top: minuteToY(b.start, dayStart),
                        height: minuteToY(b.end, b.start),
                        backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--color-linie-control) 35%, transparent) 6px 7px)",
                      }}
                    >
                      {b.label}
                    </div>
                  ))}
                  {isToday && <NowLine now={now} dayStart={dayStart} dayEnd={dayEnd} showLabel={colIndex === 0} />}
                  {items.map((a) => {
                    const place = lanes.get(a.id) ?? { lane: 0, lanes: 1 };
                    const width = 100 / place.lanes;
                    return (
                      <AppointmentBlock
                        key={a.id}
                        appointment={a}
                        now={now}
                        withDoctor={kind === "cabinet"}
                        withLocation={multiClinic}
                        dragging={drag?.active === true && drag.id === a.id}
                        style={{
                          top: minuteToY(a.startMinute, dayStart),
                          height: Math.max(minuteToY(a.endMinute, a.startMinute), SLOT_MINUTES * PX_PER_MINUTE) - 1,
                          left: `${place.lane * width}%`,
                          width: `${width}%`,
                        }}
                        onOpen={(id) => {
                          setSlot(null);
                          setSelectedId(id);
                        }}
                        onKeyDown={(e) => onBlockKey(e, a, colIndex)}
                        onMovePointerDown={options ? (e) => startMove(e, a, col.id) : undefined}
                        onResizePointerDown={options ? (e) => startResize(e, a, col.id) : undefined}
                      />
                    );
                  })}
                  {ghostSource && drag && drag.columnId === col.id && (
                    <AppointmentBlock
                      appointment={{ ...ghostSource, startMinute: drag.start, endMinute: drag.end }}
                      now={now}
                      ghost
                      style={{ top: minuteToY(drag.start, dayStart), height: minuteToY(drag.end, drag.start) - 1, left: 0, width: "100%" }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {drag?.active && (
          <p role="status" className="sr-only">
            {`Mutați la ${minutesToHHMM(drag.start)}, ${findColumn(drag.columnId)?.label ?? ""}`}
          </p>
        )}
      </div>
      <p className="mt-2 hidden text-mic text-discret md:block">
        Clic pe o oră liberă pentru o programare nouă. Trageți o programare ca s-o mutați; săgețile trec de la una la alta, Enter o deschide, M o mută.
      </p>

      <AppointmentDrawer
        appointment={selected}
        open={!!selected}
        onClose={() => setSelectedId(null)}
        onMove={(a) => {
          setSelectedId(null);
          setMoving({ a, target: null });
        }}
        now={now}
      />
      {moving && options && (
        <MoveDialog
          appointment={moving.a}
          open
          target={moving.target}
          onClose={() => setMoving(null)}
          doctors={data.doctors.map((d) => ({ id: d.id, name: d.name }))}
          canChangeDoctor={!options.forcedDoctorId}
          canOverride={options.canOverride}
          role={options.role}
        />
      )}
      {slot && options && (
        <QuickCreatePopover
          slot={slot}
          options={options}
          onClose={() => setSlot(null)}
          onCreated={(id) => {
            setSlot(null);
            refresh();
            setSelectedId(id);
          }}
        />
      )}
    </>
  );
}

function ColumnHeader({ col, isToday, isWeek, count, clinica }: { col: CalendarColumn; isToday: boolean; isWeek: boolean; count: number; clinica: string | null }) {
  const label = isWeek ? (
    <Link href={calendarHref({ vedere: "zi", zi: col.dateISO, clinica })} className="hover:underline hover:underline-offset-4">
      {col.label}
    </Link>
  ) : (
    col.label
  );
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex h-12 flex-col justify-center border-b border-linie px-2",
        isToday && isWeek ? "bg-menta-pal" : "bg-suprafata",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={cn("truncate text-mic font-semibold text-cerneala", isToday && isWeek && "underline decoration-actiune decoration-2 underline-offset-4")}>
          {label}
        </span>
        {count > 0 && <span className="shrink-0 text-micro text-discret cifre">{count}</span>}
      </span>
      <span className="truncate text-micro text-discret">{col.open.length === 0 ? "Nu lucrează" : (col.sublabel ?? `${minutesToHHMM(col.open[0][0])}–${minutesToHHMM(col.open[col.open.length - 1][1])}`)}</span>
    </div>
  );
}

/** The parts of `[dayStart, dayEnd)` outside the open intervals (shaded). */
function closedRanges(open: [number, number][], dayStart: number, dayEnd: number): [number, number][] {
  const out: [number, number][] = [];
  let cursor = dayStart;
  for (const [s, e] of [...open].sort((a, b) => a[0] - b[0])) {
    if (s > cursor) out.push([cursor, Math.min(s, dayEnd)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) out.push([cursor, dayEnd]);
  return out;
}
