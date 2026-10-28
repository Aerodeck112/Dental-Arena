import { cn } from "@/lib/cn";

/**
 * A small ring for pending buttons and inline waits. Under reduced motion it stays still,
 * so it must never be the only signal: pair it with text or aria-busy.
 * Never use it as a page loader; slow availability uses the thread (§8).
 */
export function Spinner({
  size = 18,
  label,
  className,
}: {
  size?: number;
  /** Accessible text, e.g. „Se încarcă”. Omit when the surrounding control already says it. */
  label?: string;
  className?: string;
}) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="da-spin"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
