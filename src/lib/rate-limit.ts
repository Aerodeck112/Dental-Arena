import "server-only";
import { prisma } from "./db";

/**
 * Fixed-window rate limiting stored in `RateLimitBucket` (docs/architecture.md §8.2), so limits
 * hold across instances on PostgreSQL as well as SQLite. Expired rows are purged by the
 * maintenance job.
 *
 * Every call counts as one attempt, including calls that are refused. Each step is a single
 * conditional write, so concurrent requests never lose or share a count: a live window is
 * incremented (the new count is returned by the same statement), an expired one is restarted only
 * if it is still expired, and a missing one is created (the loser of a concurrent insert simply
 * counts again).
 */

type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

const MAX_ATTEMPTS = 5;

function result(limit: number, count: number, resetAt: Date, now: Date): RateLimitResult {
  const ok = count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - count),
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

/** P2002: unique constraint violated; P2025: the record to update does not exist (or no longer matches). */
function isPrismaError(e: unknown, code: "P2002" | "P2025"): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === code;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const now = new Date();
    const newResetAt = new Date(now.getTime() + windowSec * 1000);

    const existing = await prisma.rateLimitBucket.findUnique({ where: { key }, select: { resetAt: true } });

    if (existing && existing.resetAt > now) {
      // 1. Inside a live window: increment and read the new count in one statement.
      try {
        const row = await prisma.rateLimitBucket.update({
          where: { key, resetAt: { gt: now } },
          data: { count: { increment: 1 } },
          select: { count: true, resetAt: true },
        });
        return result(limit, row.count, row.resetAt, now);
      } catch (e) {
        if (!isPrismaError(e, "P2025")) throw e; // the window expired or was purged meanwhile
        continue;
      }
    }

    if (existing) {
      // 2. An expired window: start a new one, unless another request just did.
      const restarted = await prisma.rateLimitBucket.updateMany({
        where: { key, resetAt: { lte: now } },
        data: { count: 1, resetAt: newResetAt },
      });
      if (restarted.count === 1) return result(limit, 1, newResetAt, now);
      continue;
    }

    // 3. No bucket yet: open one. If a concurrent request created it first, count again.
    try {
      await prisma.rateLimitBucket.create({ data: { key, count: 1, resetAt: newResetAt } });
      return result(limit, 1, newResetAt, now);
    } catch (e) {
      if (!isPrismaError(e, "P2002")) throw e;
    }
  }
  // Only under extreme contention on one key: fail closed, the client may retry in a second.
  return { ok: false, remaining: 0, retryAfterSec: 1 };
}

/** Clears a bucket (for example after a successful login, or in tests). */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
