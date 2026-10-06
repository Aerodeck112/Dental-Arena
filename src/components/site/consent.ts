import { useSyncExternalStore } from "react";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS } from "@/content/legal/cookies";

/**
 * The visitor's cookie choice (architecture §8.4): cookie `da_consent` = `{ v: 1, harti, at }`.
 * Only the Google Maps embeds depend on it; there is no analytics. Client-only helpers.
 */

export type ConsentState = { v: 1; harti: boolean; at: string };

/** Fired on window after the choice changes (MapConsent listens). */
export const CONSENT_EVENT = "da:consent";
/** Fired by „Setări cookie-uri” in the footer to reopen the banner on its settings. */
export const OPEN_SETTINGS_EVENT = "da:cookie-settings";

export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ConsentState>;
    if (v && v.v === 1 && typeof v.harti === "boolean" && typeof v.at === "string") return { v: 1, harti: v.harti, at: v.at };
  } catch {
    /* a damaged cookie counts as no choice */
  }
  return null;
}

/** The raw cookie value (JSON), or null. */
export function readConsentCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CONSENT_COOKIE) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function writeConsent(harti: boolean): ConsentState {
  const state: ConsentState = { v: 1, harti, at: new Date().toISOString() };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Path=/; Max-Age=${
    CONSENT_MAX_AGE_DAYS * 86_400
  }; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
  return state;
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

const SERVER = "\u0000server";

/**
 * The current choice: `undefined` while rendering on the server and during hydration (the cookie
 * is unknown there), `null` when the visitor has not chosen yet, otherwise the choice.
 */
export function useConsent(): ConsentState | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => readConsentCookie(document.cookie),
    () => SERVER,
  );
  if (raw === SERVER) return undefined;
  return parseConsent(raw);
}
