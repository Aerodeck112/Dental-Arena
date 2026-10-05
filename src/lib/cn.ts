/**
 * Joins class names, skipping falsy parts. Pure, so client and server code can share it.
 * There is no conflict resolution: components put their defaults first and the caller's
 * `className` last, and callers only pass classes that do not fight the defaults.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    out = out ? `${out} ${part}` : part;
  }
  return out;
}
