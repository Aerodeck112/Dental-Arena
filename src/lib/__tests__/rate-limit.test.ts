import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});

import { prisma } from "../db";
import { rateLimit, resetRateLimit } from "../rate-limit";
import { uniqueTag } from "./helpers/test-db";

const prefix = uniqueTag("rl");

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: prefix } } });
});

describe("rateLimit (fixed window in RateLimitBucket)", () => {
  it("allows `limit` calls, then refuses with a retry delay", async () => {
    const key = `${prefix}:basic`;
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await rateLimit(key, 3, 600));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[0].retryAfterSec).toBe(0);
    expect(results[3].retryAfterSec).toBeGreaterThan(590);
    expect(results[3].retryAfterSec).toBeLessThanOrEqual(600);
  });

  it("keeps keys independent", async () => {
    await rateLimit(`${prefix}:a`, 1, 600);
    expect((await rateLimit(`${prefix}:a`, 1, 600)).ok).toBe(false);
    expect((await rateLimit(`${prefix}:b`, 1, 600)).ok).toBe(true);
  });

  it("opens a new window once the old one has expired", async () => {
    const key = `${prefix}:expiry`;
    await rateLimit(key, 1, 600);
    expect((await rateLimit(key, 1, 600)).ok).toBe(false);
    await prisma.rateLimitBucket.update({ where: { key }, data: { resetAt: new Date(Date.now() - 1000) } });
    const fresh = await rateLimit(key, 1, 600);
    expect(fresh).toEqual({ ok: true, remaining: 0, retryAfterSec: 0 });
    const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(row?.count).toBe(1);
    expect(row!.resetAt.getTime()).toBeGreaterThan(Date.now() + 590_000);
  });

  it("counts concurrent calls without losing any", async () => {
    const key = `${prefix}:concurrent`;
    const results = await Promise.all(Array.from({ length: 8 }, () => rateLimit(key, 5, 600)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(row?.count).toBe(8);
  });

  it("can be reset", async () => {
    const key = `${prefix}:reset`;
    await rateLimit(key, 1, 600);
    expect((await rateLimit(key, 1, 600)).ok).toBe(false);
    await resetRateLimit(key);
    expect((await rateLimit(key, 1, 600)).ok).toBe(true);
  });
});
