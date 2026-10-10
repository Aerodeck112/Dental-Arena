"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { applyTheme, type ShellUser } from "./AppShell";
import { logout, setThemePreference } from "./actions";

const THEMES: { value: ShellUser["theme"]; label: string; Icon: typeof Sun }[] = [
  { value: "LUMINOS", label: "Luminos", Icon: Sun },
  { value: "INTUNECAT", label: "Întunecat", Icon: Moon },
  { value: "SISTEM", label: "Sistem", Icon: Monitor },
];

const itemClass =
  "flex h-9 w-full items-center gap-2 rounded-control px-3 text-left text-control text-cerneala hover:bg-adancit";

/**
 * User menu (WP1 top bar): „Contul meu”, the theme toggle (Luminos, Întunecat, Sistem; saved on
 * the account and in localStorage['da-theme'] for the root-layout script) and „Ieșiți din cont”.
 * A <details> disclosure, so it opens without JavaScript; it closes on Escape and outside clicks.
 */
export function UserMenu({ user }: { user: ShellUser }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [theme, setTheme] = useState(user.theme);
  const [, startTransition] = useTransition();
  const [, logoutAction, loggingOut] = useActionState<ActionResult<unknown> | null, FormData>(logout, null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    const close = () => {
      details.open = false;
    };
    const onPointer = (e: PointerEvent) => {
      if (details.open && !details.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        close();
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function chooseTheme(value: ShellUser["theme"]) {
    setTheme(value);
    applyTheme(value);
    startTransition(async () => {
      await setThemePreference({ theme: value });
    });
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="flex h-10 list-none items-center gap-2 rounded-control px-2 text-control text-cerneala hover:bg-adancit"
        aria-label={`Meniul contului: ${user.displayName}, ${user.roleLabel}`}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-chip bg-menta-pal text-cerneala"
        >
          <UserRound className="size-[18px]" strokeWidth={1.5} />
        </span>
        <span className="hidden max-w-40 truncate font-medium xl:inline">{user.displayName}</span>
        <ChevronDown className="size-4 text-discret" aria-hidden strokeWidth={1.5} />
      </summary>
      <div className="da-fade absolute right-0 top-full z-30 mt-1 w-64 rounded-panou border border-linie bg-suprafata p-1.5 shadow-float">
        <div className="px-3 pb-2 pt-1.5">
          <p className="truncate font-semibold">{user.displayName}</p>
          <p className="text-mic text-discret">{user.roleLabel}</p>
        </div>
        <Link href="/crm/cont" className={itemClass} onClick={() => detailsRef.current?.removeAttribute("open")}>
          <UserRound className="size-4 text-discret" aria-hidden strokeWidth={1.5} />
          Contul meu
        </Link>
        <div role="group" aria-label="Tema" className="mt-1 border-t border-linie px-1 pt-2">
          <p className="px-2 pb-1 text-mic text-discret">Tema</p>
          {THEMES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => chooseTheme(value)}
              className={cn(itemClass, theme === value && "font-semibold")}
            >
              <Icon className="size-4 text-discret" aria-hidden strokeWidth={1.5} />
              <span className="flex-1">{label}</span>
              {theme === value ? <Check className="size-4 text-actiune" aria-hidden strokeWidth={2} /> : null}
            </button>
          ))}
        </div>
        <form action={logoutAction} className="mt-1 border-t border-linie pt-1">
          <button type="submit" className={itemClass} disabled={loggingOut}>
            <LogOut className="size-4 text-discret" aria-hidden strokeWidth={1.5} />
            {loggingOut ? "Se închide sesiunea…" : "Ieșiți din cont"}
          </button>
        </form>
      </div>
    </details>
  );
}
