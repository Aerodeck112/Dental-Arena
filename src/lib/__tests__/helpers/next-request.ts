/**
 * Test doubles for `next/headers` (cookies() and headers()), so Server Actions, the DAL and the
 * request helpers can run under vitest without a Next request scope.
 *
 * Usage in a test file:
 *
 *   vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);
 *
 * Each test file runs in its own module graph, so this state is per file; call `resetRequest()`
 * in `beforeEach`.
 */

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

export type StoredCookie = { value: string; options: CookieOptions };

export const request = {
  cookies: new Map<string, StoredCookie>(),
  headers: new Headers(),
};

/** Clears cookies and sets the request headers (a client IP by default). */
export function resetRequest(headers: Record<string, string> = { "x-forwarded-for": "203.0.113.7" }) {
  request.cookies.clear();
  request.headers = new Headers(headers);
}

/** Sends a cookie with the next "request". */
export function setRequestCookie(name: string, value: string) {
  request.cookies.set(name, { value, options: {} });
}

export function getCookie(name: string): StoredCookie | undefined {
  return request.cookies.get(name);
}

const cookieStore = {
  get(name: string) {
    const c = request.cookies.get(name);
    return c && c.value !== "" ? { name, value: c.value } : undefined;
  },
  has(name: string) {
    return request.cookies.has(name);
  },
  getAll() {
    return [...request.cookies.entries()].map(([name, c]) => ({ name, value: c.value }));
  },
  set(name: string, value: string, options: CookieOptions = {}) {
    request.cookies.set(name, { value, options });
    return cookieStore;
  },
  delete(name: string) {
    request.cookies.delete(name);
    return cookieStore;
  },
};

export const nextHeadersMock = {
  cookies: async () => cookieStore,
  headers: async () => request.headers,
  draftMode: async () => ({ isEnabled: false, enable() {}, disable() {} }),
};

/** The target of a `redirect()` thrown by next/navigation („NEXT_REDIRECT;replace;/crm;307;”), else null. */
export function redirectTarget(e: unknown): string | null {
  const digest = typeof e === "object" && e !== null && "digest" in e ? String((e as { digest: unknown }).digest) : "";
  if (!digest.startsWith("NEXT_REDIRECT;")) return null;
  return digest.split(";")[2] ?? null;
}

/** Runs `fn`, expecting it to redirect; returns the target path. */
export async function expectRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    const target = redirectTarget(e);
    if (target !== null) return target;
    throw e;
  }
  throw new Error("Expected a redirect, but the call returned normally.");
}
