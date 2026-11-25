import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  /** One sentence of direction: „Nicio cerere nouă. Cererile din site apar aici imediat ce sunt trimise.” */
  title: ReactNode;
  /** The single action (a Button or ButtonLink). */
  action?: ReactNode;
  /** Optional second line. */
  children?: ReactNode;
  className?: string;
};

/** An empty screen is an invitation to act: one sentence and one action, no illustration. */
export function EmptyState({ title, action, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-panou border border-dashed border-linie-control px-5 py-6",
        className,
      )}
    >
      <p className="text-corp text-cerneala masura">{title}</p>
      {children && <div className="text-mic text-discret masura">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
