"use client";

import { useEffect, useRef, useState } from "react";
import { refreshFormTimestamp } from "./honeypot-actions";

const REFRESH_ON_MOUNT_AFTER_MS = 10 * 60 * 1000;
const REFRESH_WHILE_OPEN_AFTER_MS = 60 * 60 * 1000;
const CHECK_EVERY_MS = 10 * 60 * 1000;

function ageOf(signed: string): number {
  const ms = parseInt(signed.split(".")[0] ?? "", 36);
  return Number.isFinite(ms) ? Date.now() - ms : Number.POSITIVE_INFINITY;
}

/**
 * The hidden signed `_ts` field. Server-rendered with the render time, so it works without
 * JavaScript; with JavaScript it is refreshed when the cached page is old, or when the form stays
 * open for over an hour.
 */
export function FormTimestampInput({ name, initial }: { name: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const current = useRef(initial);

  useEffect(() => {
    let cancelled = false;
    const refresh = (backdateMs: number) =>
      refreshFormTimestamp(backdateMs)
        .then((fresh) => {
          if (cancelled) return;
          current.current = fresh;
          setValue(fresh);
        })
        .catch(() => {
          /* keep the current value; the server decides */
        });

    if (ageOf(current.current) > REFRESH_ON_MOUNT_AFTER_MS) void refresh(0);
    const timer = window.setInterval(() => {
      if (ageOf(current.current) > REFRESH_WHILE_OPEN_AFTER_MS) void refresh(60_000);
    }, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return <input type="hidden" name={name} value={value} />;
}
