/**
 * Safe post-login redirect (docs/architecture.md §8.1): only same-origin paths under /crm, never
 * the login page itself, never protocol-relative (`//evil`), backslashes or control characters.
 * Pure; unit-tested.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/crm"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 1000) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith("/crm")) return fallback;
  const rest = next.slice("/crm".length);
  if (rest !== "" && !/^[/?#]/.test(rest)) return fallback;
  if (next.startsWith("//") || rest.startsWith("//")) return fallback;
  if (next === "/crm/login" || next.startsWith("/crm/login?") || next.startsWith("/crm/login/")) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost" || !url.pathname.startsWith("/crm")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
