import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Bearer check for `/api/cron/*` (docs/architecture.md §8.1). Both values are hashed first, so the
 * timing-safe comparison never depends on the length of the guess.
 */
export function isCronAuthorized(authorization: string | null, secret: string = env.CRON_SECRET): boolean {
  if (!authorization || !secret) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) return false;
  const given = createHash("sha256").update(match[1].trim()).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}

export const CRON_HEADERS = { "Cache-Control": "no-store" } as const;

export function unauthorized(): Response {
  return Response.json(
    { error: "Lipsește tokenul de acces sau nu este corect." },
    { status: 401, headers: { ...CRON_HEADERS, "WWW-Authenticate": 'Bearer realm="cron"' } },
  );
}
