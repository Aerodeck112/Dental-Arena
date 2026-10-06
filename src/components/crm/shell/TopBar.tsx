"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, Plus, Search } from "lucide-react";
import type { ClinicScope } from "@/lib/clinic-scope";
import type { ShellUser } from "./AppShell";
import { useShell } from "./AppShell";
import { ClinicSwitch } from "./ClinicSwitch";
import { UserMenu } from "./UserMenu";

/** True while the user is typing somewhere, so single-key shortcuts stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Top bar (WP1): clinic switch, patient search (a GET form to /crm/pacienti?q=, focused with „/”
 * or Ctrl+K), „Programare nouă” (also „N”) and the user menu.
 */
export function TopBar({ user, scope, scopes }: { user: ShellUser; scope: ClinicScope; scopes: ClinicScope[] }) {
  const { setMobileOpen } = useShell();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if ((e.key === "n" || e.key === "N") && user.canCreateAppointment) {
        e.preventDefault();
        router.push("/crm/programari/noua");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, user.canCreateAppointment]);

  return (
    <header data-print="ascuns" className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 bg-fundal px-3 py-2 md:px-4">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-control text-cerneala hover:bg-adancit md:hidden"
        aria-label="Deschideți meniul"
      >
        <Menu className="size-5" aria-hidden strokeWidth={1.5} />
      </button>

      <ClinicSwitch scope={scope} options={scopes} className="order-3 w-full sm:order-none sm:w-auto" />

      <form action="/crm/pacienti" method="get" role="search" className="order-2 min-w-0 flex-1 sm:order-none">
        <label htmlFor="cautare-pacient" className="sr-only">
          Căutați pacient după nume, telefon, e-mail sau număr de fișă
        </label>
        <div className="relative max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-discret"
            aria-hidden
            strokeWidth={1.5}
          />
          <input
            ref={searchRef}
            id="cautare-pacient"
            name="q"
            type="search"
            autoComplete="off"
            placeholder="Căutați pacient: nume, telefon"
            aria-keyshortcuts="/ Control+K"
            className="h-10 w-full text-ellipsis rounded-control border border-linie-control bg-suprafata pl-9 pr-3 text-control text-cerneala placeholder:text-discret sm:pr-10"
          />
          <kbd
            aria-hidden="true"
            className="cifre pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-bloc border border-linie px-1.5 text-micro text-discret sm:block"
          >
            /
          </kbd>
        </div>
      </form>

      <div className="order-2 ml-auto flex items-center gap-2 sm:order-none">
        {user.canCreateAppointment ? (
          <Link
            href="/crm/programari/noua"
            aria-keyshortcuts="N"
            className="apasat inline-flex h-10 items-center gap-2 rounded-control bg-actiune px-3 text-control font-medium text-pe-actiune transition-colors duration-150 hover:bg-actiune-apasat"
          >
            <Plus className="size-4" aria-hidden strokeWidth={2} />
            <span className="hidden sm:inline">Programare nouă</span>
            <span className="sr-only sm:hidden">Programare nouă</span>
          </Link>
        ) : null}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
