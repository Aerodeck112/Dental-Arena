"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMFORT_PARAM, comfortFromParam, type ComfortValue } from "@/server/leads/schemas";
import type { BookingOptions } from "@/server/scheduling/types";

/**
 * Wizard state (docs/architecture.md §6.5): kept in React, mirrored to the URL (so a reload or a
 * shared link lands on the same choices) and to `sessionStorage` (so going back, or reloading,
 * never loses what the visitor typed). Server render and first client render use the same
 * initial state; stored values are merged after mount.
 */

export const UNSURE_KEY = "nu-stiu";
export const STORAGE_KEY = "da-programare";
/** Written by the comfort question on the home page (WP3). */
export const COMFORT_STORAGE_KEY = "da-confort";

export const STEP_NAMES = ["Motivul și clinica", "Ziua și ora", "Cum vă simțiți", "Datele dumneavoastră"] as const;
export const STEP_COUNT = STEP_NAMES.length;

export type ForWhom = "eu" | "copil";

export type BookingState = {
  /** A serviceId, or UNSURE_KEY for „Nu știu sigur”. */
  reasonKey: string | null;
  locationId: string | null;
  /** null = „Oricare medic”. */
  doctorId: string | null;
  dateISO: string | null;
  startsAt: string | null;
  localTime: string | null;
  comfort: ComfortValue | null;
  wantsSedation: boolean;
  comfortNote: string;
  name: string;
  phone: string;
  email: string;
  forWhom: ForWhom;
  childFirstName: string;
  childAge: string;
  note: string;
  consentGdpr: boolean;
  consentSms: boolean;
};

export const EMPTY_STATE: BookingState = {
  reasonKey: null,
  locationId: null,
  doctorId: null,
  dateISO: null,
  startsAt: null,
  localTime: null,
  comfort: null,
  wantsSedation: false,
  comfortNote: "",
  name: "",
  phone: "",
  email: "",
  forWhom: "eu",
  childFirstName: "",
  childAge: "",
  note: "",
  consentGdpr: false,
  consentSms: false,
};

/** Fields the visitor types; restored from sessionStorage even when the URL prefills the rest. */
const TYPED_FIELDS = [
  "wantsSedation",
  "comfortNote",
  "name",
  "phone",
  "email",
  "forWhom",
  "childFirstName",
  "childAge",
  "note",
  "consentSms",
] as const satisfies readonly (keyof BookingState)[];

/** The first step that still needs an answer (design system §6.7: prefill skips ahead, in order). */
export function firstOpenStep(s: BookingState): number {
  if (!s.reasonKey || !s.locationId) return 0;
  if (!s.startsAt) return 1;
  if (!s.comfort) return 2;
  return 3;
}

export function serviceIdOf(s: Pick<BookingState, "reasonKey">, o: Pick<BookingOptions, "unsureServiceId">): string | null {
  if (!s.reasonKey) return null;
  return s.reasonKey === UNSURE_KEY ? o.unsureServiceId : s.reasonKey;
}

/** The query string of a state: `?serviciu=&clinica=&medic=&ora=&confort=&pas=` (§4.1). */
export function stateToQuery(s: BookingState, step: number, o: BookingOptions): string {
  const p = new URLSearchParams();
  if (s.reasonKey) {
    const reason = o.reasons.find((r) => r.serviceId === s.reasonKey);
    p.set("serviciu", s.reasonKey === UNSURE_KEY ? UNSURE_KEY : (reason?.code ?? s.reasonKey));
  }
  const clinic = o.clinics.find((c) => c.id === s.locationId);
  if (clinic) p.set("clinica", clinic.slug);
  const doctor = o.doctors.find((d) => d.id === s.doctorId);
  if (doctor) p.set("medic", doctor.slug);
  if (s.startsAt) p.set("ora", s.startsAt);
  if (s.comfort) p.set("confort", COMFORT_PARAM[s.comfort]);
  if (step > 0) p.set("pas", String(step + 1));
  const q = p.toString();
  return q ? `?${q}` : "";
}

type Stored = { state: Partial<BookingState>; key?: string };

function readStored(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed && typeof parsed === "object" && parsed.state ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(v: Stored | null) {
  try {
    if (v) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the wizard still works, it just forgets on reload */
  }
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export function useBookingState(opts: {
  initial: BookingState;
  /** True when the URL carried choices: they win over what sessionStorage remembers. */
  prefilled: boolean;
  idempotencyKey: string;
  options: BookingOptions;
}) {
  const { options } = opts;
  const [state, setState] = useState<BookingState>(opts.initial);
  const [step, setStep] = useState<number>(() => firstOpenStep(opts.initial));
  const [idempotencyKey, setIdempotencyKey] = useState(opts.idempotencyKey);
  const restored = useRef(false);

  // After mount: merge what this tab remembers, and the comfort answer from the home page.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const stored = readStored();
    let comfortFromHome: ComfortValue | null = null;
    try {
      comfortFromHome = comfortFromParam(window.sessionStorage.getItem(COMFORT_STORAGE_KEY));
    } catch {
      /* ignore */
    }
    if (!stored && !comfortFromHome) return;
    // No interaction can happen before this first effect, so the initial state is the current one.
    const next = { ...opts.initial };
    const s = stored?.state ?? {};
    for (const k of TYPED_FIELDS) {
      if (s[k] !== undefined) (next as Record<string, unknown>)[k] = s[k];
    }
    if (!opts.prefilled) {
      if (s.reasonKey && (s.reasonKey === UNSURE_KEY || options.reasons.some((r) => r.serviceId === s.reasonKey))) next.reasonKey = s.reasonKey;
      if (s.locationId && options.clinics.some((c) => c.id === s.locationId)) next.locationId = s.locationId;
      if (s.doctorId && options.doctors.some((d) => d.id === s.doctorId)) next.doctorId = s.doctorId;
      if (s.startsAt && Date.parse(s.startsAt) > Date.now()) {
        next.startsAt = s.startsAt;
        next.dateISO = s.dateISO ?? null;
        next.localTime = s.localTime ?? null;
      }
      if (s.comfort) next.comfort = s.comfort;
    }
    if (!next.comfort && comfortFromHome) next.comfort = comfortFromHome;
    // One-time merge of browser-only storage after hydration (sessionStorage does not exist on the server).
    /* eslint-disable react-hooks/set-state-in-effect */
    setState(next);
    setStep(firstOpenStep(next));
    if (stored?.key && /^[0-9a-f-]{36}$/i.test(stored.key)) setIdempotencyKey(stored.key);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [opts.initial, opts.prefilled, options]);

  // Mirror to sessionStorage and the URL (replaceState: no server round trip, no history spam).
  useEffect(() => {
    if (!restored.current) return;
    writeStored({ state, key: idempotencyKey });
    try {
      const url = `${window.location.pathname}${stateToQuery(state, step, options)}`;
      if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
    } catch {
      /* ignore */
    }
  }, [state, step, idempotencyKey, options]);

  const update = useCallback((patch: Partial<BookingState>) => setState((s) => ({ ...s, ...patch })), []);

  const goTo = useCallback((n: number) => setStep(Math.max(0, Math.min(STEP_COUNT - 1, n))), []);

  /** After a successful booking: forget everything but keep the visitor's contact details for a second booking. */
  const finish = useCallback(() => {
    writeStored(null);
    setIdempotencyKey(newKey());
  }, []);

  const serviceId = useMemo(() => serviceIdOf(state, options), [state, options]);

  return { state, update, step, goTo, idempotencyKey, finish, serviceId };
}
