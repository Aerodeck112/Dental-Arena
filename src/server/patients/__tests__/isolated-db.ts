import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Each WP7 integration test file works on its own copy of the migrated `prisma/test-wp7.db`, so the
 * files can run in parallel without SQLite lock timeouts. Call it from `vi.hoisted()`.
 */
export function isolatedTestDb(name: string): string {
  const src = path.resolve(process.cwd(), "prisma/test-wp7.db");
  const dir = mkdtempSync(path.join(tmpdir(), `wp7-${name}-`));
  const file = path.join(dir, "test.db");
  copyFileSync(src, file);
  return `file:${file}`;
}
