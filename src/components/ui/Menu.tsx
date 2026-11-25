"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
import { useDismiss } from "./use-dismiss";

export type MenuItem =
  | {
      label: string;
      /** A link item (internal paths use next/link; tel:, mailto: and http stay plain). */
      href?: string;
      onSelect?: () => void;
      icon?: IconName;
      /** Right-aligned detail, e.g. a phone number („0265 326 316”). */
      detail?: string;
      /** Screen-reader name when the visible text is not enough („Sunați la Cristești, 0265 326 316”). */
      ariaLabel?: string;
      tone?: "danger";
      disabled?: boolean;
      /** Marks the current choice (theme, clinic) with a check. */
      checked?: boolean;
    }
  | { separator: true };

export type MenuProps = {
  trigger: ReactNode;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  /** Show a chevron after the trigger label. Default true. */
  chevron?: boolean;
  items: MenuItem[];
  /** Accessible name of the menu. */
  label?: string;
  align?: "start" | "end";
  className?: string;
};

const isPlain = (href: string) => /^(https?:|tel:|mailto:|sms:)/.test(href);

/**
 * A menu button (WAI-ARIA pattern): Enter, Space or ↓ open on the first item, ↑ on the last;
 * arrows, Home and End move; Esc closes and returns focus; Tab closes. Closes on outside click.
 */
export function Menu({
  trigger,
  triggerLabel,
  triggerVariant = "secondary",
  triggerSize = "m",
  triggerClassName,
  chevron = true,
  items,
  label,
  align = "start",
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();
  const triggerId = useId();

  const actionable = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !("separator" in item) && !item.disabled)
    .map(({ i }) => i);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useDismiss(wrapper, open, (reason) => close(reason === "escape"));

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  const openAt = (where: "first" | "last") => {
    setFocusIndex(where === "first" ? actionable[0] ?? 0 : actionable[actionable.length - 1] ?? 0);
    setOpen(true);
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt("last");
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const pos = actionable.indexOf(focusIndex);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex(actionable[(pos + 1) % actionable.length]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex(actionable[(pos - 1 + actionable.length) % actionable.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIndex(actionable[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIndex(actionable[actionable.length - 1]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapper} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={triggerLabel}
        onClick={() => (open ? close(false) : openAt("first"))}
        onKeyDown={onTriggerKey}
        className={buttonClasses({ variant: triggerVariant, size: triggerSize, className: triggerClassName })}
      >
        {trigger}
        {chevron && (
          <Icon name="chevron-down" size={18} className={cn("transition-transform duration-150", open && "rotate-180")} />
        )}
      </button>
      <div
        id={menuId}
        role="menu"
        aria-label={label}
        aria-labelledby={label ? undefined : triggerId}
        hidden={!open}
        onKeyDown={onMenuKey}
        className={cn(
          "da-rise absolute top-full z-50 mt-2 min-w-60 rounded-panou border border-linie bg-suprafata py-1.5 text-cerneala shadow-float",
          align === "start" ? "left-0" : "right-0",
        )}
      >
        {items.map((item, i) => {
          if ("separator" in item) return <div key={i} role="separator" className="my-1.5 h-px bg-linie" />;
          const cls = cn(
            "flex min-h-control-s w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-left text-control",
            "outline-offset-[-2px] hover:bg-adancit focus-visible:bg-adancit",
            item.tone === "danger" ? "text-carmin" : "text-cerneala",
            item.disabled && "cursor-not-allowed text-discret hover:bg-transparent",
          );
          const content = (
            <>
              {item.icon ? (
                <Icon name={item.icon} size={18} className={item.tone === "danger" ? "text-carmin" : "text-discret"} />
              ) : item.checked !== undefined ? (
                <Icon name="check" size={18} className={cn("text-actiune", !item.checked && "invisible")} />
              ) : null}
              <span className="flex-1">{item.label}</span>
              {item.detail && <span className="telefon text-discret">{item.detail}</span>}
            </>
          );
          const common = {
            ref: (el: HTMLElement | null) => {
              itemRefs.current[i] = el;
            },
            role: item.checked !== undefined ? "menuitemradio" : "menuitem",
            "aria-checked": item.checked,
            "aria-label": item.ariaLabel,
            "aria-disabled": item.disabled || undefined,
            tabIndex: -1,
            className: cls,
          } as const;
          const select = () => {
            if (item.disabled) return;
            item.onSelect?.();
            close(!item.href);
          };
          if (item.href && !item.disabled) {
            return isPlain(item.href) ? (
              <a key={i} href={item.href} onClick={select} {...common}>
                {content}
              </a>
            ) : (
              <Link key={i} href={item.href} onClick={select} {...common}>
                {content}
              </Link>
            );
          }
          return (
            <button key={i} type="button" onClick={select} {...common}>
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
