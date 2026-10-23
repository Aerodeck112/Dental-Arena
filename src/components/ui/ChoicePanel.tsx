import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type ChoicePanelProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  /** Clinic or doctor name, set in Forum 24 („Cristești”). */
  title: ReactNode;
  children?: ReactNode;
  selected?: boolean;
  /** Link mode (no JS): the panel navigates instead of toggling. */
  href?: string;
};

const classes = (selected: boolean, className?: string) =>
  cn(
    "apasat relative flex w-full flex-col items-start gap-1.5 rounded-panou border p-5 text-left",
    "transition-[background-color,border-color,box-shadow] duration-150 ease-filet",
    selected
      ? "border-cerneala bg-menta-pal shadow-[0_0_0_1px_var(--da-cerneala)]"
      : "border-linie-control bg-suprafata hover:border-cerneala",
    "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent",
    className,
  );

/** A larger choice: a clinic panel with its address and next free slot (booking step 1). */
export function ChoicePanel({ title, children, selected = false, href, className, type = "button", ...rest }: ChoicePanelProps) {
  const body = (
    <>
      <span className="flex w-full items-start justify-between gap-3">
        <span className="font-display text-nume text-cerneala">{title}</span>
        {selected && (
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-cerneala text-suprafata">
            <Icon name="check" size={18} strokeWidth={2.5} />
          </span>
        )}
      </span>
      {children && <span className="flex flex-col gap-1 text-corp text-discret">{children}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={classes(selected, className)}>
        {body}
      </Link>
    );
  }
  return (
    <button type={type} aria-pressed={selected} className={classes(selected, className)} {...rest}>
      {body}
    </button>
  );
}
