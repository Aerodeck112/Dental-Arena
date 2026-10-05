"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ClinicScope } from "@/lib/clinic-scope";
import type { NavCountKey } from "./nav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** What the shell needs to know about the signed-in user (a DTO, never a Prisma row). */
export type ShellUser = {
  displayName: string;
  firstName: string;
  role: "ADMIN" | "MEDIC" | "RECEPTIE";
  roleLabel: string;
  theme: "SISTEM" | "LUMINOS" | "INTUNECAT";
  canCreateAppointment: boolean;
};

type ShellState = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <AppShell>.");
  return ctx;
}

const SIDEBAR_KEY = "da-sidebar";
const THEME_KEY = "da-theme";

/** Applies a theme preference to <html> and remembers it for the root-layout script. */
export function applyTheme(theme: ShellUser["theme"]) {
  const root = document.documentElement;
  try {
    if (theme === "SISTEM") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme === "INTUNECAT" ? "dark" : "light");
  } catch {
    /* storage may be unavailable (private mode) */
  }
  if (theme === "SISTEM") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme === "INTUNECAT" ? "dark" : "light");
}

function storedTheme(): ShellUser["theme"] {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "INTUNECAT") return "INTUNECAT";
    if (t === "light" || t === "LUMINOS") return "LUMINOS";
  } catch {
    /* ignore */
  }
  return "SISTEM";
}

/**
 * CRM shell (design system §6.8): a 240px sidebar on `fundal` that collapses to a 64px rail, a
 * top bar with the clinic switch, patient search, „Programare nouă” and the user menu, and the
 * work area on `suprafata`.
 */
export function AppShell({
  user,
  scope,
  counts,
  children,
}: {
  user: ShellUser;
  scope: ClinicScope;
  counts: Partial<Record<NavCountKey, number>>;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      // Restoring a per-device preference after hydration; the server cannot know it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(SIDEBAR_KEY) === "rail") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep this device in step with the theme saved on the account (for example after logging in elsewhere).
  useEffect(() => {
    if (storedTheme() !== user.theme) applyTheme(user.theme);
  }, [user.theme]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "rail" : "full");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, mobileOpen],
  );

  return (
    <ShellContext.Provider value={value}>
      <a
        href="#continut"
        className="sr-only z-50 rounded-control bg-suprafata px-3 py-2 text-control font-medium text-cerneala focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Săriți la conținut
      </a>
      <div className="flex min-h-dvh bg-fundal text-cerneala">
        <Sidebar user={user} counts={counts} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} scope={scope} />
          <main
            id="continut"
            tabIndex={-1}
            className="min-w-0 flex-1 border-linie bg-suprafata px-4 py-5 outline-none md:rounded-tl-panou md:border-l md:border-t md:px-6"
          >
            {children}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
