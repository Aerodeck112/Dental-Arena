"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useDismiss } from "@/components/ui/use-dismiss";
import { minutesToHHMM } from "@/lib/time";
import type { AppointmentFormOptions } from "@/server/appointments/types";
import { AppointmentForm } from "./AppointmentForm";

export type QuickSlot = {
  columnId: string;
  columnLabel: string;
  date: string;
  startMinute: number;
  locationId: string;
  doctorId: string | null;
  cabinetId: string | null;
  /** Viewport point the panel opens next to. */
  x: number;
  y: number;
};

const WIDTH = 368;

/**
 * Quick-create next to an empty slot (design system §6.8): patient search or „Pacient nou”,
 * the reason with its duration, inhalosedare and a note. Esc or a click outside closes it.
 * On phones it opens as a bottom sheet.
 */
export function QuickCreatePopover({
  slot,
  options,
  onClose,
  onCreated,
}: {
  slot: QuickSlot;
  options: AppointmentFormOptions;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; sheet: boolean } | null>(null);
  const dismiss = useCallback(() => onClose(), [onClose]);
  useDismiss(ref, true, dismiss);

  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 640) {
      setPos({ left: 0, top: 0, sheet: true });
      return;
    }
    const left = slot.x + 12 + WIDTH > vw - 8 ? Math.max(8, slot.x - WIDTH - 12) : slot.x + 12;
    const top = Math.max(8, Math.min(slot.y - 48, vh - Math.min(640, vh * 0.85) - 8));
    setPos({ left, top, sheet: false });
  }, [slot.x, slot.y]);

  const time = minutesToHHMM(slot.startMinute);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={`Programare nouă la ${time}, ${slot.columnLabel}`}
      className={
        pos?.sheet
          ? "da-rise fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-panou border-t border-linie bg-suprafata p-4 shadow-float"
          : "da-rise fixed z-40 max-h-[min(640px,85vh)] overflow-y-auto rounded-panou border border-linie bg-suprafata p-4 shadow-float"
      }
      style={pos && !pos.sheet ? { left: pos.left, top: pos.top, width: WIDTH } : pos ? undefined : { visibility: "hidden" }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-h3 font-semibold">
          Programare nouă la <span className="cifre">{time}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închideți"
          className="apasat -mr-2 -mt-1 inline-flex size-control-s items-center justify-center rounded-control text-discret hover:bg-adancit hover:text-cerneala"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
      <AppointmentForm
        mode="quick"
        idPrefix={`qc-${slot.columnId}`}
        options={options}
        initial={{
          locationId: slot.locationId,
          doctorId: slot.doctorId,
          cabinetId: slot.cabinetId,
          date: slot.date,
          time,
          durationMinutes: 30,
        }}
        onSuccess={(r) => onCreated(r.id)}
        onCancel={onClose}
      />
    </div>
  );
}
