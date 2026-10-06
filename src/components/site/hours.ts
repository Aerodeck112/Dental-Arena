import { minutesToHHMM } from "@/lib/time";
import type { PublicLocationHours } from "@/server/public/types";

const WEEKDAY = ["", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

/** „Luni–Vineri 09:00–17:00”: consecutive days with the same hours share one line. */
export function hoursLines(hours: PublicLocationHours[]): string[] {
  const byDay = new Map<number, string>();
  for (const h of hours) {
    const span = `${minutesToHHMM(h.openMinute)}–${minutesToHHMM(h.closeMinute)}`;
    byDay.set(h.weekday, byDay.has(h.weekday) ? `${byDay.get(h.weekday)}, ${span}` : span);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const lines: string[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1 && byDay.get(days[j + 1]) === byDay.get(days[i])) j++;
    const label = i === j ? WEEKDAY[days[i]] : `${WEEKDAY[days[i]]}–${WEEKDAY[days[j]].toLocaleLowerCase("ro-RO")}`;
    lines.push(`${label}: ${byDay.get(days[i])}`);
    i = j + 1;
  }
  return lines;
}
