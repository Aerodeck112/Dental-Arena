/**
 * WP1 integration tests use `prisma/test-wp1.db`, migrated by vitest.global-setup.ts. Point the
 * test file at it before anything imports `@/lib/env` or `@/lib/db`:
 *
 *   vi.hoisted(() => { process.env.DATABASE_URL = "file:./prisma/test-wp1.db"; });
 *
 * Files run in parallel against the same database, so each file uses its own unique e-mails and
 * keys (see `uniqueTag`).
 */
let counter = 0;

/** A short tag that is unique per test file run, for e-mails, slugs and rate-limit keys. */
export function uniqueTag(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now().toString(36)}-${counter}`;
}
