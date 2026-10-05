import "server-only";
import { prisma } from "./db";

/**
 * Fixed-window rate limiting stored in `RateLimitBucket` (docs/architecture.md §8.2), so limits
 * hold across instances on PostgreSQL as well as SQLite. Expired rows are purged by the
 * maintenance job.
 *
 * Every call counts as one attempt, including calls that are refused.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    try {
      // 1. Inside a live window: count atomically.
      const bumped = await prisma.rateLimitBucket.updateMany({
        where: { key, resetAt: { gt: now } },
        data: { count: { increment: 1 } },
      });
      let count: number;
      let resetAt: Date;
      if (bumped.count === 1) {
        const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
        if (!row) continue;
        count = row.count;
        resetAt = row.resetAt;
      } else {
        // 2. No bucket or an expired one: open a new window.
        resetAt = new Date(now.getTime() + windowSec * 1000);
        await prisma.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, resetAt },
          update: { count: 1, resetAt },
        });
        count = 1;
      }
      const ok = count <= limit;
      return {
        ok,
        remaining: Math.max(0, limit - count),
        retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
      };
    } catch (e) {
      // A concurrent first request may win the insert (unique key); retry once it exists.
      if (attempt === 2) throw e;
    }
  }
  return { ok: true, remaining: limit, retryAfterSec: 0 };
}

/** Clears a bucket (for example after a successful login, or in tests). */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
