"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type WeekStripDay = {
  dateISO: string;
  /** „lun. 6” or two lines with "\n": „lun.\n6 oct.” */
  label: string;
  /** No free slots that day. */
  disabled: boolean;
};

export type WeekStripProps = {
  days: WeekStripDay[];
  value: string | null;
  onChange: (dateISO: string) => void;
  /** Accessible name, e.g. „Alegeți ziua”. */
  label?: string;
  className?: string;
};

/**
 * 14 days in a scroll-snapped row (booking step 2). A radio group: ← → move between the days that
 * have slots, Home and End jump, days without slots are skipped and announced as unavailable.
 */
export function WeekStrip({ days, value, onChange, label = "Alegeți ziua", className }: WeekStripProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = days.map((d, i) => (d.disabled ? -1 : i)).filter((i) => i >= 0);
  const selectedIndex = days.findIndex((d) => d.dateISO === value && !d.disabled);
  const tabbable = selectedIndex >= 0 ? selectedIndex : (enabled[0] ?? -1);

  useEffect(() => {
    if (selectedIndex >= 0) refs.current[selectedIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedIndex]);

  const move = (from: number, key: string) => {
    const pos = enabled.indexOf(from);
    let next: number | undefined;
    if (key === "ArrowRight" || key === "ArrowDown") next = enabled[Math.min(pos + 1, enabled.length - 1)];
    if (key === "ArrowLeft" || key === "ArrowUp") next = enabled[Math.max(pos - 1, 0)];
    if (key === "Home") next = enabled[0];
    if (key === "End") next = enabled[enabled.length - 1];
    if (next === undefined) return false;
    onChange(days[next].dateISO);
    refs.current[next]?.focus();
    return true;
  };

  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (move(i, e.key)) e.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:thin]", className)}
    >
      {days.map((d, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={d.dateISO}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={d.disabled || undefined}
            tabIndex={i === tabbable ? 0 : -1}
            onClick={() => !d.disabled && onChange(d.dateISO)}
            onKeyDown={onKey(i)}
            className={cn(
              "apasat inline-flex min-h-control-l min-w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center rounded-control border px-3 py-1.5",
              "text-center text-mic leading-tight whitespace-pre-line cifre transition-[background-color,border-color] duration-[120ms] ease-filet",
              d.disabled
                ? "cursor-not-allowed border-dashed border-linie-control text-discret"
                : selected
                  ? "border-cerneala bg-menta font-semibold text-pe-menta shadow-[0_0_0_1px_var(--da-cerneala)]"
                  : "border-linie-control bg-suprafata text-cerneala hover:border-cerneala",
            )}
          >
            {d.label}
            {d.disabled && <span className="sr-only">, nicio oră liberă</span>}
          </button>
        );
      })}
    </div>
  );
}
