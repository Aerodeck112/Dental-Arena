import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type ChoiceTone = "neutral" | "calm" | "comfort";

export type ChoiceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /**
   * What the fill means when chosen:
   * neutral → Mentă pal (a booking reason), calm → Mentă („N-am emoții”),
   * comfort → Muștar („Am puține emoții”, „Mi-e frică”: this person asked for gentleness).
   */
  tone?: ChoiceTone;
  /** A plain line under the label. */
  description?: ReactNode;
  children: ReactNode;
};

/** An answer the visitor picks: 56px on the site, radius-control, check plus 2px border when chosen. */
export function ChoiceButton({
  selected = false,
  tone = "neutral",
  description,
  className,
  children,
  type = "button",
  ...rest
}: ChoiceButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "apasat inline-flex min-h-control-l items-center gap-2.5 rounded-control border px-4 py-2 text-left text-control font-medium",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-filet",
        "disabled:cursor-not-allowed disabled:border-dashed disabled:text-discret",
        selected
          ? cn(
              "border-cerneala shadow-[0_0_0_1px_var(--da-cerneala)]",
              tone === "neutral" && "bg-menta-pal text-cerneala",
              tone === "calm" && "bg-menta text-pe-menta",
              tone === "comfort" && "bg-mustar text-pe-menta",
            )
          : "border-linie-control bg-suprafata text-cerneala hover:border-cerneala",
        className,
      )}
      {...rest}
    >
      {selected && <Icon name="check" size={20} strokeWidth={2.25} className="shrink-0" />}
      <span className="flex flex-col">
        <span>{children}</span>
        {description && (
          <span className={cn("text-mic font-normal", selected && tone !== "neutral" ? "text-pe-menta" : "text-discret")}>
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
