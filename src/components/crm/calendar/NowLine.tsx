"use client";

import { useEffect, useState } from "react";
import { minutesToHHMM, utcToLocal } from "@/lib/time";
import { minuteToY } from "./layout";

/**
 * The current time, ticking every 30 s. Starts from the server's instant so the first client
 * render matches the HTML.
 */
export function useNow(initialISO: string, everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date(initialISO));
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 1000);
    const id = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [everyMs]);
  return now;
}

/** The 2 px `actiune` now-line across today's columns, with its time label in the gutter. */
export function NowLine({ now, dayStart, dayEnd, showLabel = true }: { now: Date; dayStart: number; dayEnd: number; showLabel?: boolean }) {
  const minute = utcToLocal(now).minute;
  if (minute < dayStart || minute >= dayEnd) return null;
  const top = minuteToY(minute, dayStart);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10" style={{ top }}>
      <div className="h-0.5 w-full bg-actiune" />
      {showLabel && (
        <span className="absolute -top-2.5 left-0 rounded-bloc bg-actiune px-1 text-micro font-semibold text-pe-actiune cifre">
          {minutesToHHMM(minute)}
        </span>
      )}
    </div>
  );
}
