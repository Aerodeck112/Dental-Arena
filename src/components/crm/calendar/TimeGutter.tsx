import { minutesToHHMM } from "@/lib/time";
import { hourMarks, minuteToY } from "./layout";

/** Hour labels down the left edge of the grid (sticky while scrolling sideways). */
export function TimeGutter({ dayStart, dayEnd }: { dayStart: number; dayEnd: number }) {
  const height = minuteToY(dayEnd, dayStart);
  return (
    <div aria-hidden="true" className="sticky left-0 z-20 w-14 shrink-0 border-r border-linie bg-suprafata" style={{ height }}>
      {hourMarks(dayStart, dayEnd).map((m) => (
        <span
          key={m}
          className="absolute right-2 -translate-y-1/2 text-micro text-discret cifre first:translate-y-0"
          style={{ top: minuteToY(m, dayStart) }}
        >
          {minutesToHHMM(m)}
        </span>
      ))}
    </div>
  );
}
