"use client";

import { useLayoutEffect } from "react";

/** CRM theme choice. Accepts the ThemePreference enum values too. */
export type ThemeChoice = "light" | "dark" | "system" | "LUMINOS" | "INTUNECAT" | "SISTEM";

export const THEME_STORAGE_KEY = "da-theme";

function normalise(choice: string | null | undefined): "light" | "dark" | "system" {
  if (choice === "dark" || choice === "INTUNECAT") return "dark";
  if (choice === "light" || choice === "LUMINOS") return "light";
  return "system";
}

/**
 * Applies a theme now and remembers it for the root-layout script (localStorage „da-theme”).
 * „system” removes data-theme, so prefers-color-scheme decides.
 */
export function applyTheme(choice: ThemeChoice) {
  const theme = normalise(choice);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode: the attribute still applies for this page.
  }
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Put once in the CRM shell. Re-applies the saved theme after client navigations and after React's
 * development remount (which resets <html> attributes), and clears it when leaving the CRM so the
 * public site always follows the system. `theme` (from User.theme) wins over localStorage.
 */
export function ThemeSync({ theme }: { theme?: ThemeChoice | null }) {
  useLayoutEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      saved = null;
    }
    applyTheme(normalise(theme ?? saved));
    return () => document.documentElement.removeAttribute("data-theme");
  }, [theme]);
  return null;
}
