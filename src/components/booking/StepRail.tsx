"use client";

import { ThreadSteps } from "@/components/brand/ThreadSteps";
import { STEP_NAMES } from "./useBookingState";

/**
 * Booking progress (design system §6.7, §7): the thread rail with the step names on desktop, and
 * the 28px glyph with „Pasul 2 din 4” on phones. Completed steps are buttons back to that step;
 * the glyph is decorative, the ordered list carries the meaning (`aria-current="step"`).
 */
export function StepRail({
  current,
  onSelect,
  loading = false,
  variant,
}: {
  current: number;
  onSelect: (step: number) => void;
  loading?: boolean;
  variant: "rail" | "inline";
}) {
  return (
    <ThreadSteps
      steps={[...STEP_NAMES]}
      current={current}
      variant={variant}
      loading={loading}
      label="Pașii programării"
      onStepSelect={onSelect}
    />
  );
}
