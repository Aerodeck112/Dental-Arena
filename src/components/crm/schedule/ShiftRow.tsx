"use client";

import { Button } from "@/components/ui/Button";
import { FlagTag } from "@/components/ui/FlagTag";
import { formatDateRo } from "@/lib/format";
import { minutesToHHMM } from "@/lib/time";
import type { ShiftDTO } from "@/server/scheduling/schedules";

export const WEEKDAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

export function rangeLabel(start: number, end: number): string {
  return `${minutesToHHMM(start)}–${minutesToHHMM(end)}`;
}

/** „din 01.11.2026”, „până la 31.12.2026”, „01.11.2026–31.12.2026”, or null when always valid. */
export function validityLabel(from: string | null, until: string | null): string | null {
  if (from && until) return `${formatDateRo(from, "short")}–${formatDateRo(until, "short")}`;
  if (from) return `din ${formatDateRo(from, "short")}`;
  if (until) return `până la ${formatDateRo(until, "short")}`;
  return null;
}

type ShiftViewProps = {
  shift: ShiftDTO;
  cabinetName: string | null;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function shiftName(shift: ShiftDTO): string {
  return `${WEEKDAYS[shift.weekday - 1].toLowerCase()}, ${rangeLabel(shift.startMinute, shift.endMinute)}`;
}

function ShiftActions({ shift, onEdit, onDelete }: Pick<ShiftViewProps, "shift" | "onEdit" | "onDelete">) {
  return (
    <>
      <Button variant="text" size="s" icon="pencil" onClick={onEdit} aria-label={`Modificați intervalul de ${shiftName(shift)}`}>
        Modificați
      </Button>
      <Button variant="text" size="s" icon="x" onClick={onDelete} aria-label={`Ștergeți intervalul de ${shiftName(shift)}`}>
        Ștergeți
      </Button>
    </>
  );
}

/** The same shift as a stacked list item, for narrow screens where the table would scroll sideways. */
export function ShiftCard({ shift, cabinetName, canManage, onEdit, onDelete }: ShiftViewProps) {
  const validity = validityLabel(shift.validFrom, shift.validUntil);
  return (
    <li className="flex flex-col gap-2 border-b border-linie py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-corp text-cerneala">
          <span className="font-semibold">{WEEKDAYS[shift.weekday - 1]}</span>{" "}
          <span className="cifre">{rangeLabel(shift.startMinute, shift.endMinute)}</span>
        </p>
        {shift.onlineBooking ? <FlagTag kind="online">Online</FlagTag> : <span className="text-mic text-discret">Doar la telefon</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-mic">
        <dt className="text-discret">Pauze</dt>
        <dd className="cifre text-cerneala">
          {shift.breaks.length > 0 ? shift.breaks.map((b) => rangeLabel(b.startMinute, b.endMinute)).join(", ") : "Fără pauză"}
        </dd>
        <dt className="text-discret">Cabinet</dt>
        <dd className="text-cerneala">{cabinetName ?? "Oricare"}</dd>
        <dt className="text-discret">Valabilitate</dt>
        <dd className="cifre text-cerneala">{validity ?? "Permanent"}</dd>
      </dl>
      {canManage && (
        <div className="-ml-2 flex flex-wrap gap-1">
          <ShiftActions shift={shift} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </li>
  );
}

/** One weekly shift in the schedule table: hours, breaks, cabinet, online flag, validity. */
export function ShiftRow({ shift, cabinetName, canManage, onEdit, onDelete }: ShiftViewProps) {
  const validity = validityLabel(shift.validFrom, shift.validUntil);
  return (
    <tr className="border-b border-linie align-top last:border-b-0">
      <th scope="row" className="py-2 pr-4 text-left font-semibold text-cerneala">
        {WEEKDAYS[shift.weekday - 1]}
      </th>
      <td className="py-2 pr-4 cifre whitespace-nowrap text-cerneala">{rangeLabel(shift.startMinute, shift.endMinute)}</td>
      <td className="py-2 pr-4 cifre text-discret">
        {shift.breaks.length > 0 ? shift.breaks.map((b) => rangeLabel(b.startMinute, b.endMinute)).join(", ") : "Fără pauză"}
      </td>
      <td className="py-2 pr-4 text-cerneala">{cabinetName ?? <span className="text-discret">Oricare</span>}</td>
      <td className="py-2 pr-4">
        {shift.onlineBooking ? <FlagTag kind="online">Online</FlagTag> : <span className="text-discret">Doar la telefon</span>}
      </td>
      <td className="py-2 pr-4 cifre text-discret">{validity ?? "Permanent"}</td>
      {canManage && (
        <td className="py-1 text-right whitespace-nowrap">
          <ShiftActions shift={shift} onEdit={onEdit} onDelete={onDelete} />
        </td>
      )}
    </tr>
  );
}
