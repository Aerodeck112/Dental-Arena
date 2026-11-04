import type { AppointmentStatus } from "@/generated/prisma/enums";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * Appointment status, coded by fill, edge, icon and word, never colour alone (§3.3, §0.2):
 * dashed = not yet certain, solid edge = confirmed, full Mentă = in the clinic,
 * recessed = done, struck through = cancelled, red edge = no-show.
 */
export const STATUS_ICON: Record<AppointmentStatus, IconName> = {
  PROGRAMAT: "clock",
  CONFIRMAT: "check",
  SOSIT: "door-open",
  IN_TRATAMENT: "activity",
  FINALIZAT: "check-check",
  ANULAT: "circle-slash",
  NEPREZENTAT: "user-x",
};

const CHIP: Record<AppointmentStatus, string> = {
  PROGRAMAT: "border-[1.5px] border-dashed border-discret bg-suprafata text-cerneala",
  CONFIRMAT: "border-[1.5px] border-actiune bg-menta-pal text-cerneala",
  SOSIT: "border-[1.5px] border-actiune-apasat bg-menta text-pe-menta",
  IN_TRATAMENT: "border-[1.5px] border-actiune-apasat bg-menta text-pe-menta",
  FINALIZAT: "border-[1.5px] border-transparent bg-adancit text-discret",
  ANULAT: "border border-dashed border-linie-control bg-transparent text-discret",
  NEPREZENTAT: "border-[1.5px] border-carmin bg-carmin-pal text-carmin",
};

/**
 * Classes for a calendar block in the same status (WP6 AppointmentBlock): radius-bloc, the fill,
 * and the edge (dashed outline, 4px left bar, or none). Text colours included.
 */
export const STATUS_BLOCK: Record<AppointmentStatus, string> = {
  PROGRAMAT: "rounded-bloc border-[1.5px] border-dashed border-discret bg-suprafata text-cerneala",
  CONFIRMAT: "rounded-bloc border-l-4 border-actiune bg-menta-pal text-cerneala",
  SOSIT: "rounded-bloc border-l-4 border-actiune-apasat bg-menta text-pe-menta",
  IN_TRATAMENT: "rounded-bloc border-l-4 border-actiune-apasat bg-menta text-pe-menta",
  FINALIZAT: "rounded-bloc bg-adancit text-discret",
  ANULAT: "rounded-bloc border border-dashed border-linie-control bg-transparent text-discret [&_[data-status-text]]:line-through",
  NEPREZENTAT: "rounded-bloc border-l-4 border-carmin bg-carmin-pal text-cerneala",
};

export type StatusChipProps = {
  status: AppointmentStatus;
  size?: "s" | "m";
  /** Running detail after the word: „12 min” → „În tratament, 12 min”. */
  detail?: string;
  /** Icon only (blocks under 30 minutes); the word stays for screen readers. */
  iconOnly?: boolean;
  className?: string;
};

export function StatusChip({ status, size = "m", detail, iconOnly = false, className }: StatusChipProps) {
  const label = APPOINTMENT_STATUS_LABEL[status];
  const text = detail ? `${label}, ${detail}` : label;
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-chip font-medium whitespace-nowrap",
        size === "s" ? "h-6 px-2 text-micro" : "h-7 px-2.5 text-mic",
        iconOnly && (size === "s" ? "w-6 justify-center px-0" : "w-7 justify-center px-0"),
        CHIP[status],
        className,
      )}
    >
      <Icon name={STATUS_ICON[status]} size={size === "s" ? 14 : 16} strokeWidth={2} />
      <span className={cn("cifre", iconOnly && "sr-only", status === "ANULAT" && "line-through")}>{text}</span>
    </span>
  );
}
