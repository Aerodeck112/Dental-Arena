"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { ComfortDot } from "@/components/ui/FlagTag";
import { Icon } from "@/components/ui/Icon";
import { STATUS_BLOCK, STATUS_ICON } from "@/components/ui/StatusChip";
import { cn } from "@/lib/cn";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/labels";
import { minutesToHHMM } from "@/lib/time";
import type { CalendarAppointment } from "@/server/appointments/types";
import { blockSize } from "./layout";

/** Minutes in the chair: Sosit since arrival, În tratament since the start of treatment. */
export function chairMinutes(a: Pick<CalendarAppointment, "status" | "arrivedAt" | "startedAt">, now: Date): number | null {
  const since = a.status === "IN_TRATAMENT" ? a.startedAt : a.status === "SOSIT" ? a.arrivedAt : null;
  if (!since) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
}

/** „Sosit, 12 min”, „În tratament, 12 min”, or the plain status word. */
export function statusText(a: Pick<CalendarAppointment, "status" | "arrivedAt" | "startedAt">, now: Date): string {
  const minutes = chairMinutes(a, now);
  const label = APPOINTMENT_STATUS_LABEL[a.status];
  return minutes === null ? label : `${label}, ${minutes} min`;
}

/** The screen-reader sentence of a block: time, patient, status, service, doctor, overlays. */
export function blockLabel(a: CalendarAppointment, now: Date, o: { withDoctor?: boolean } = {}): string {
  return [
    `${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)}`,
    a.title,
    statusText(a, now),
    a.serviceName ?? a.reason,
    o.withDoctor ? a.doctorName : null,
    ...a.flags.map((f) => f.label),
  ]
    .filter(Boolean)
    .join(", ");
}

export type AppointmentBlockProps = {
  appointment: CalendarAppointment;
  now: Date;
  style: CSSProperties;
  /** Show the doctor (cabinet columns) and the clinic (both clinics in scope). */
  withDoctor?: boolean;
  withLocation?: boolean;
  /** Rendered as the drag ghost (60% opacity, no interaction). */
  ghost?: boolean;
  /** The block whose drag is in progress (its original stays faded). */
  dragging?: boolean;
  onOpen?: (id: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onMovePointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onResizePointerDown?: (e: PointerEvent<HTMLElement>) => void;
};

/**
 * One appointment in the grid (design system §3.3, §3.4): fill, edge, icon and word by status;
 * the alert icon in the corner; the mustard dot for comfort; „Online” and „Copil” as words when
 * there is room. Under 30 minutes the status word is dropped (icon and edge stay).
 */
export function AppointmentBlock({
  appointment: a,
  now,
  style,
  withDoctor = false,
  withLocation = false,
  ghost = false,
  dragging = false,
  onOpen,
  onKeyDown,
  onMovePointerDown,
  onResizePointerDown,
}: AppointmentBlockProps) {
  const size = blockSize(a.endMinute - a.startMinute);
  const alert = a.flags.find((f) => f.kind === "alerta");
  const comfort = a.flags.find((f) => f.kind === "confort" || f.kind === "sedare");
  const tags = a.flags.filter((f) => f.kind === "online" || f.kind === "copil");
  const detail = a.serviceName ?? a.reason;
  const meta = [withDoctor ? a.doctorName : null, withLocation ? a.locationName : null].filter(Boolean).join(", ");
  const movable = a.canManage && (a.status === "PROGRAMAT" || a.status === "CONFIRMAT");

  return (
    <div
      className={cn("absolute px-px", ghost && "pointer-events-none z-30 opacity-60", dragging && "opacity-40")}
      style={style}
      data-appointment-id={ghost ? undefined : a.id}
    >
      <button
        type="button"
        data-block={ghost ? undefined : a.id}
        aria-label={blockLabel(a, now, { withDoctor: true })}
        aria-haspopup="dialog"
        tabIndex={ghost ? -1 : 0}
        onClick={() => onOpen?.(a.id)}
        onKeyDown={onKeyDown}
        onPointerDown={movable ? onMovePointerDown : undefined}
        className={cn(
          "group relative flex h-full w-full flex-col overflow-hidden text-left text-micro leading-4",
          size === "s" ? "justify-center px-1.5 py-0" : "px-1.5 py-1",
          STATUS_BLOCK[a.status],
          movable && "cursor-grab active:cursor-grabbing",
          ghost && "shadow-float ring-2 ring-cerneala",
          "focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1",
        )}
        style={{ touchAction: movable ? "none" : undefined }}
      >
        <span className="flex min-w-0 items-center gap-1">
          <Icon name={STATUS_ICON[a.status]} size={12} strokeWidth={2} className="shrink-0" />
          {size !== "s" && <span className="shrink-0 cifre opacity-80">{minutesToHHMM(a.startMinute)}</span>}
          <span data-status-text className="min-w-0 truncate font-semibold">
            {a.title}
          </span>
          {comfort && <ComfortDot className="ml-auto" />}
          {alert && <Icon name="alert-triangle" size={12} strokeWidth={2.25} className={cn("shrink-0 text-carmin", !comfort && "ml-auto")} />}
        </span>
        {size !== "s" && (
          <span className="min-w-0 truncate">
            <span data-status-text>{statusText(a, now)}</span>
            {detail && <span className="opacity-90">, {detail}</span>}
          </span>
        )}
        {size === "l" && (meta || tags.length > 0 || comfort) && (
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
            {comfort && <span className="rounded-bloc bg-mustar-pal px-1 text-mustar-text">{comfort.label}</span>}
            {tags.map((t) => (
              <span key={t.kind} className="rounded-bloc border border-current/40 px-1">
                {t.label}
              </span>
            ))}
            {meta && <span className="truncate opacity-80">{meta}</span>}
          </span>
        )}
        {size === "m" && tags.length > 0 && !detail && <span className="truncate">{tags.map((t) => t.label).join(", ")}</span>}
      </button>
      {movable && !ghost && onResizePointerDown && (
        <span
          aria-hidden="true"
          onPointerDown={onResizePointerDown}
          className="absolute inset-x-2 bottom-0 h-1.5 cursor-ns-resize rounded-full opacity-0 hover:bg-cerneala/30 hover:opacity-100"
          style={{ touchAction: "none" }}
        />
      )}
    </div>
  );
}
