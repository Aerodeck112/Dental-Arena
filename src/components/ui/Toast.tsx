"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Toasts: „Programare confirmată”, „Programare mutată la 11:30” with „Anulați”.
 * One polite live region (<Toaster /> once per layout; extra ones stay empty); each toast stays 6 seconds, longer while
 * hovered or focused. `useToast()` works anywhere in client code, no provider needed.
 */

export type ToastKind = "success" | "error";
export type ToastInput = { kind: ToastKind; message: string; undo?: () => void; undoLabel?: string };
type ToastItem = ToastInput & { id: number };

export const TOAST_DURATION_MS = 6000;

let items: ToastItem[] = [];
let nextId = 1;
/** Mounted Toasters; only the first one renders, so a second <Toaster /> never duplicates toasts. */
let owners: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getSnapshot = () => items;
/** Must be the same array on every call, or React warns about an infinite loop. */
const SERVER_ITEMS: ToastItem[] = [];
const getServerSnapshot = () => SERVER_ITEMS;
const getOwner = () => owners[0] ?? null;
const getServerOwner = () => null;

export function showToast(input: ToastInput): number {
  const id = nextId++;
  // Newest last; keep at most three on screen.
  items = [...items, { ...input, id }].slice(-3);
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToast() {
  const show = useCallback((input: ToastInput) => showToast(input), []);
  const dismiss = useCallback((id: number) => dismissToast(id), []);
  return { show, dismiss };
}

export function Toaster({ className }: { className?: string }) {
  const id = useId();
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const owner = useSyncExternalStore(subscribe, getOwner, getServerOwner);
  useEffect(() => {
    owners = [...owners, id];
    emit();
    return () => {
      owners = owners.filter((o) => o !== id);
      emit();
    };
  }, [id]);
  if (owner !== null && owner !== id) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        "sm:items-end sm:p-6",
        className,
      )}
    >
      {owner === id && list.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>
  );
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS);
  }, [toast.id]);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  return (
    <div
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
      className={cn(
        "da-rise pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-panou border bg-suprafata py-2.5 pr-2 pl-4 text-control shadow-float",
        toast.kind === "error" ? "border-carmin" : "border-linie",
      )}
    >
      <Icon
        name={toast.kind === "error" ? "alert-triangle" : "check"}
        size={20}
        className={toast.kind === "error" ? "text-carmin" : "text-actiune"}
      />
      <p className="min-w-0 flex-1 text-cerneala">
        {toast.kind === "error" && <span className="sr-only">Eroare: </span>}
        {toast.message}
      </p>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            dismissToast(toast.id);
          }}
          className="apasat h-control-s shrink-0 rounded-control px-3 font-semibold text-link underline underline-offset-4 hover:decoration-2"
        >
          {toast.undoLabel ?? "Anulați"}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Închideți notificarea"
        className="apasat inline-flex size-control-s shrink-0 items-center justify-center rounded-control text-discret hover:bg-adancit hover:text-cerneala"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
