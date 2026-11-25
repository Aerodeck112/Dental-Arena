import { cn } from "@/lib/cn";

/**
 * A count next to a label („Cereri online 3”): cerneala on menta-pal, pill. Never mustard,
 * never red. `label` gives screen readers the meaning („3 cereri noi”).
 */
export function CountBadge({ count, label, max = 99, className }: { count: number; label?: string; max?: number; className?: string }) {
  const shown = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cn(
        "inline-flex h-[1.5em] min-w-[1.5em] items-center justify-center rounded-chip bg-menta-pal px-1.5 text-micro font-semibold text-cerneala cifre",
        className,
      )}
    >
      <span aria-hidden={label ? true : undefined}>{shown}</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
