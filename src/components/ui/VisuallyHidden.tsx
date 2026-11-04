import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Text for screen readers only. `focusable` makes it appear on focus (skip links). */
export function VisuallyHidden({
  children,
  as: Tag = "span",
  focusable = false,
  className,
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  focusable?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn("sr-only", focusable && "focus:not-sr-only", className)}>
      {children}
    </Tag>
  );
}
