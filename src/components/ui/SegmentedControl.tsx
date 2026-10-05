"use client";

import Link from "next/link";
import { useId, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";

export type SegmentOption = { value: string; label: string; href?: string };

export type SegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  /** Form mode: radios with this name, submitted with the surrounding <form>. */
  name?: string;
  /** Client mode: called with the chosen value. */
  onChange?: (value: string) => void;
  /** Form mode: submit the form as soon as the choice changes (clinic switch). */
  submitOnChange?: boolean;
  /** Accessible name of the group, e.g. „Clinica”. */
  label: string;
  size?: "s" | "m";
  className?: string;
};

const SELECTED = "bg-suprafata font-semibold text-cerneala shadow-[0_0_0_1.5px_var(--da-cerneala)]";
const base = (size: "s" | "m") =>
  cn(
    "inline-flex flex-1 items-center justify-center rounded-[4px] px-3 text-control whitespace-nowrap transition-colors duration-150",
    size === "s" ? "min-h-[calc(var(--spacing-control-s)-6px)]" : "min-h-[calc(var(--spacing-control)-6px)]",
  );
const linkSegment = (selected: boolean, size: "s" | "m") =>
  cn(base(size), selected ? SELECTED : "text-discret hover:text-cerneala");
/* Radios: the look follows :checked, so form mode works without JS. */
const radioSegment = (size: "s" | "m") =>
  cn(
    base(size),
    "relative cursor-pointer text-discret hover:text-cerneala",
    "has-[:checked]:bg-suprafata has-[:checked]:font-semibold has-[:checked]:text-cerneala has-[:checked]:shadow-[0_0_0_1.5px_var(--da-cerneala)]",
    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
  );

/**
 * Two to four mutually exclusive choices (Cristești | Luduș | Ambele; Zi | Săptămână).
 * Link mode when options carry `href` (works without JS), form mode with `name`, or client mode.
 */
export function SegmentedControl({
  options,
  value,
  name,
  onChange,
  submitOnChange = false,
  label,
  size = "m",
  className,
}: SegmentedControlProps) {
  const autoName = useId();
  const wrap = cn("inline-flex gap-0.5 rounded-control border border-linie-control bg-adancit p-[3px]", className);

  if (options.every((o) => o.href)) {
    return (
      <nav aria-label={label} className={wrap}>
        {options.map((o) => (
          <Link
            key={o.value}
            href={o.href!}
            aria-current={o.value === value ? "page" : undefined}
            className={linkSegment(o.value === value, size)}
          >
            {o.label}
          </Link>
        ))}
      </nav>
    );
  }

  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
    if (submitOnChange) e.target.form?.requestSubmit();
  };
  const groupName = name ?? autoName;

  return (
    <div role="radiogroup" aria-label={label} className={wrap}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <label key={o.value} className={radioSegment(size)}>
            <input
              type="radio"
              name={groupName}
              value={o.value}
              className="sr-only"
              {...(onChange || submitOnChange ? { checked: selected, onChange: handle } : { defaultChecked: selected })}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
