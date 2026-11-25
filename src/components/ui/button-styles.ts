import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger";
export type ButtonSize = "s" | "m" | "l";

/**
 * Shared look of Button and ButtonLink (§10): radius by object type (6px), sizes from the
 * density tokens (site 48/48/56, CRM 32/40/48), colour-only hover, 1px press.
 */
export function buttonClasses({
  variant = "primary",
  size = "m",
  iconOnly = false,
  loading = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  /** While loading the button keeps its normal look (label plus spinner), only the cursor changes. */
  loading?: boolean;
  className?: string;
}): string {
  const height = size === "s" ? "h-control-s" : size === "l" ? "h-control-l" : "h-control";
  const width = iconOnly
    ? size === "s"
      ? "w-control-s"
      : size === "l"
        ? "w-control-l"
        : "w-control"
    : variant === "text"
      ? "px-1"
      : size === "s"
        ? "px-3"
        : size === "l"
          ? "px-7"
          : "px-5";
  if (loading) {
    return cn(
      "relative inline-flex shrink-0 cursor-progress items-center justify-center gap-2 whitespace-nowrap rounded-control text-control font-medium select-none",
      height,
      width,
      variant === "primary" && "bg-actiune text-pe-actiune",
      variant === "secondary" && "border-[1.5px] border-cerneala bg-transparent text-cerneala",
      variant === "text" && "bg-transparent text-link underline decoration-1 underline-offset-4",
      variant === "danger" && "border-[1.5px] border-carmin bg-transparent text-carmin",
      className,
    );
  }
  return cn(
    "apasat relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control",
    "text-control font-medium select-none",
    "transition-colors duration-150 ease-filet",
    "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
    height,
    width,
    variant === "primary" &&
      "bg-actiune text-pe-actiune hover:bg-actiune-apasat active:bg-actiune-apasat disabled:bg-adancit disabled:text-discret aria-disabled:bg-adancit aria-disabled:text-discret",
    variant === "secondary" &&
      "border-[1.5px] border-cerneala bg-transparent text-cerneala hover:bg-adancit disabled:border-linie-control disabled:text-discret aria-disabled:border-linie-control aria-disabled:text-discret",
    variant === "text" &&
      "bg-transparent text-link underline decoration-1 underline-offset-4 hover:decoration-2 disabled:text-discret disabled:no-underline aria-disabled:text-discret",
    variant === "danger" &&
      "border-[1.5px] border-carmin bg-transparent text-carmin hover:bg-carmin-pal disabled:border-linie-control disabled:text-discret aria-disabled:border-linie-control aria-disabled:text-discret",
    className,
  );
}

/** Icon size that sits well inside each button size. */
export function buttonIconSize(size: ButtonSize = "m"): number {
  return size === "s" ? 16 : size === "l" ? 22 : 20;
}
