import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type SlotButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** „10:30” */
  time: string;
  selected?: boolean;
  disabled?: boolean;
  /** Someone else took it: disabled, struck through, announced as „ocupat”. */
  taken?: boolean;
  /** Full-width row with the day on the left („marți 7 oct.”), as on the mobile home panel. */
  day?: ReactNode;
};

/**
 * A free time slot. 56px on the site; selected = Mentă fill, 2px cerneala border and a check.
 * Shared with the CRM quick-create. Never preselected.
 */
export function SlotButton({ time, selected = false, disabled = false, taken = false, day, className, type = "button", ...rest }: SlotButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || taken}
      aria-pressed={disabled || taken ? undefined : selected}
      className={cn(
        "apasat inline-flex h-control-l min-w-[5.5rem] items-center gap-2 rounded-control border px-4 text-control font-semibold cifre",
        "transition-[background-color,border-color,box-shadow] duration-[120ms] ease-filet",
        day ? "w-full justify-between" : "justify-center",
        selected
          ? "border-cerneala bg-menta text-pe-menta shadow-[0_0_0_1px_var(--da-cerneala)]"
          : "border-linie-control bg-suprafata text-cerneala hover:border-cerneala hover:bg-menta-pal",
        (disabled || taken) &&
          "cursor-not-allowed border-dashed border-linie-control bg-transparent font-normal text-discret hover:border-linie-control hover:bg-transparent",
        className,
      )}
      {...rest}
    >
      {day && <span className="font-normal">{day}</span>}
      <span className="inline-flex items-center gap-1.5">
        {selected && <Icon name="check" size={18} strokeWidth={2.25} />}
        <span className={cn(taken && "line-through")}>{time}</span>
        {taken && <span className="sr-only">, ocupat</span>}
      </span>
    </button>
  );
}
