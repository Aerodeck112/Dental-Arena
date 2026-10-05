import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type FlagKind = "confort" | "alerta" | "copil" | "online" | "neutral" | "sedare";

/**
 * Overlays that are independent of status (§3.4). Mustard means emotional comfort, red means
 * clinical risk; they never swap. Always a word, never a dot or colour alone.
 * - confort: „Mi-e frică”, „Emoții” (dot + mustar-pal)
 * - sedare: „Preferă inhalosedare” (mustar-pal, no dot)
 * - alerta: „Alergie: penicilină”, „Anticoagulante” (carmin outline + alert icon)
 * - copil: „Copil, 7 ani”; online: „Online”; neutral: anything else
 */
export function FlagTag({ kind, children, className }: { kind: FlagKind; children: ReactNode; className?: string }) {
  return (
    <span
      data-flag={kind}
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-bloc px-2 py-0.5 text-mic font-medium",
        (kind === "confort" || kind === "sedare") && "bg-mustar-pal text-mustar-text",
        kind === "alerta" && "border-[1.5px] border-carmin text-carmin",
        (kind === "copil" || kind === "online" || kind === "neutral") && "border border-linie-control text-discret",
        className,
      )}
    >
      {kind === "confort" && <ComfortDot />}
      {kind === "alerta" && <Icon name="alert-triangle" size={15} strokeWidth={2} />}
      {children}
    </span>
  );
}

/** The 8px mustard dot with its 1px mustar-text ring. Decorative: pair it with a word. */
export function ComfortDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full bg-mustar ring-1 ring-mustar-text", className)}
    />
  );
}
