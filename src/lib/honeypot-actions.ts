"use server";

import { signFormTimestamp } from "./honeypot";

/**
 * Fresh signed form timestamp for pages served from the static cache (`revalidate`), whose
 * render-time timestamp may be hours old. Read-only: it mutates nothing.
 *
 * `backdateMs` (at most 5 minutes) keeps the minimum fill time satisfied when a form that has
 * been open for a long time is refreshed while the visitor is typing.
 */
export async function refreshFormTimestamp(backdateMs: number = 0): Promise<string> {
  const back = Math.min(Math.max(0, Number(backdateMs) || 0), 5 * 60 * 1000);
  return signFormTimestamp(new Date(Date.now() - back));
}
