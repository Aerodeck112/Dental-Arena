import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import {
  partsViewBox,
  stepState,
  threadParts,
  ThreadGlyph,
  type ThreadSegment,
  type ThreadState,
} from "./ThreadGlyph";

export type ThreadStepItem = {
  label: string;
  /** One plain sentence under the step name (list variant). */
  detail?: string;
  /** Completed steps link back to this URL (rail and plan variants). */
  href?: string;
};

export type ThreadStepsVariant = "rail" | "inline" | "list" | "plan" | "mini";

type ThreadStepsProps = {
  /** 1–5 steps. A plain string is the step name. */
  steps: (string | ThreadStepItem)[];
  /** 0-based index of the current step; `steps.length` = all done; -1 = not started. */
  current: number;
  /**
   * rail: booking progress rail (glyph 160px tall, step names beside it, „Pasul 2 din 4”)
   * inline: 28px glyph and „Pasul 2 din 4” (mobile booking); names stay available to screen readers
   * list: „Cum decurge” on service pages; each step carries its own band
   * plan: CRM treatment-plan progress, horizontal
   * mini: the 14px glyph alone (odontogram implant notation)
   */
  variant: ThreadStepsVariant;
  /** Draw the crown on the completed screw: the full mark (booking confirmation). */
  crown?: boolean;
  /** Animate the crown (only when `crown`). */
  crownAnimated?: boolean;
  /** Bands fill in sequence while availability is slow to load. */
  loading?: boolean;
  /** Accessible name of the list, e.g. „Pașii programării”. */
  label?: string;
  /** Completed steps become buttons that call this (client wizards). Takes precedence over href. */
  onStepSelect?: (index: number) => void;
  className?: string;
};

function toItem(step: string | ThreadStepItem): ThreadStepItem {
  return typeof step === "string" ? { label: step } : step;
}

export function stepCounterText(current: number, total: number): string {
  if (current >= total) return total === 1 ? "Pasul este încheiat." : `Toți cei ${total} pași sunt încheiați.`;
  return `Pasul ${Math.max(1, current + 1)} din ${total}`;
}

const STATE_SR: Record<ThreadState, string> = { done: ", încheiat", current: ", pasul curent", future: "" };

export function ThreadSteps({
  steps,
  current,
  variant,
  crown = false,
  crownAnimated = false,
  loading = false,
  label = "Pași",
  onStepSelect,
  className,
}: ThreadStepsProps) {
  const items = steps.map(toItem);
  const count = items.length;

  if (variant === "list") {
    return <ThreadList items={items} current={current} label={label} className={className} />;
  }

  const glyph = (cls: string) => (
    <ThreadGlyph
      count={count}
      current={current}
      crown={crown}
      crownAnimated={crownAnimated}
      loading={loading}
      className={cls}
    />
  );

  const list = (visible: boolean, horizontal = false) => (
    <ol
      aria-label={label}
      className={cn(
        !visible && "sr-only",
        visible && (horizontal ? "flex flex-wrap items-center gap-x-4 gap-y-1" : "flex flex-col gap-3"),
      )}
    >
      {items.map((item, i) => {
        const state = stepState(i, current);
        const linked = visible && state === "done" && (!!onStepSelect || !!item.href);
        const content = <StepLabel item={item} state={state} withCheck={horizontal} linked={linked} />;
        let inner = content;
        if (visible && state === "done" && onStepSelect) {
          inner = (
            <button
              type="button"
              onClick={() => onStepSelect(i)}
              className="group/step apasat cursor-pointer rounded-control text-left text-link"
            >
              {content}
            </button>
          );
        } else if (visible && state === "done" && item.href) {
          inner = (
            <Link href={item.href} className="group/step text-link">
              {content}
            </Link>
          );
        }
        return (
          <li key={i} aria-current={state === "current" ? "step" : undefined} className="text-control">
            {inner}
          </li>
        );
      })}
    </ol>
  );

  if (variant === "mini") {
    return (
      <span className={cn("inline-flex", className)}>
        {glyph("h-3.5 w-auto")}
        {list(false)}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {glyph("h-7 w-auto")}
        <p className="text-mic text-discret cifre">{stepCounterText(current, count)}</p>
        {list(false)}
      </div>
    );
  }

  if (variant === "plan") {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        {glyph("h-10 w-auto")}
        <div className="min-w-0">
          <p className="text-mic text-discret cifre">{stepCounterText(current, count)}</p>
          {list(true, true)}
        </div>
      </div>
    );
  }

  // rail
  return (
    <div className={cn("flex items-start gap-5", className)}>
      {glyph("h-40 w-auto")}
      <div className="pt-1">
        <p className="mb-3 text-mic text-discret cifre">{stepCounterText(current, count)}</p>
        {list(true)}
      </div>
    </div>
  );
}

function StepLabel({
  item,
  state,
  withCheck,
  linked,
}: {
  item: ThreadStepItem;
  state: ThreadState;
  withCheck: boolean;
  linked: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        state === "current" && "font-semibold text-cerneala",
        state === "future" && "text-discret",
        linked && "underline decoration-1 underline-offset-4 group-hover/step:decoration-2",
      )}
    >
      {withCheck && state === "done" && <Icon name="check" size={14} className="text-actiune" />}
      {item.label}
      {STATE_SR[state] && <span className="sr-only">{STATE_SR[state]}</span>}
    </span>
  );
}

/** „Cum decurge”: one band per row, so the screw runs down the list. */
function ThreadList({
  items,
  current,
  label,
  className,
}: {
  items: ThreadStepItem[];
  current: number;
  label: string;
  className?: string;
}) {
  const { steps, tip } = threadParts(items.length);
  const span = tip ? [...steps, tip] : steps;
  const inProgress = current >= 0 && current < items.length;

  return (
    <ol aria-label={label} className={cn("flex flex-col gap-5", className)}>
      {items.map((item, i) => {
        const part = steps[i];
        const state = stepState(i, current);
        const segs: ThreadSegment[] = [{ part, state }];
        const last = i === items.length - 1;
        if (last && tip) segs.push({ part: tip, state: current >= items.length ? "done" : "future" });
        const parts = segs.map((s) => s.part);
        // Shared horizontal span keeps the taper true from row to row.
        const box = partsViewBox(parts, { spanX: span, padX: 4, padY: 4 });
        const [, , boxW, boxH] = box.split(" ").map(Number);
        return (
          <li
            key={i}
            aria-current={state === "current" ? "step" : undefined}
            className="grid grid-cols-[3.5rem_1fr] items-start gap-4"
          >
            <ThreadGlyph
              count={items.length}
              current={current}
              segments={segs}
              viewBox={box}
              className="mt-1 w-14"
              style={{ aspectRatio: `${boxW} / ${boxH}` }}
            />
            <div>
              <p className="text-control font-semibold">
                {item.label}
                {inProgress && STATE_SR[state] && <span className="sr-only">{STATE_SR[state]}</span>}
              </p>
              {item.detail && <p className="mt-1 text-corp text-discret masura">{item.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
