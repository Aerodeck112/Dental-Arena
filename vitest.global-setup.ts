import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vitest global setup (docs/architecture.md §11.1 rule 6).
 *
 * Migrates one template SQLite database with `prisma migrate deploy`, then copies it to
 * `prisma/test.db` (the default `DATABASE_URL` in vitest.config.ts) and to one file per work
 * package, `prisma/test-wp1.db` … `prisma/test-wp8.db`. Every run starts from empty, migrated
 * databases; each test file is responsible for its own data.
 */
const root = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.join(root, "prisma");
const TEST_DATABASES = ["test", ...Array.from({ length: 8 }, (_, i) => `test-wp${i + 1}`)];

function removeDb(file: string) {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(file + suffix, { force: true });
  }
}

function prismaCli(args: string[], databaseUrl: string) {
  const cli = path.join(root, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
}

export default function setup() {
  if (!existsSync(path.join(root, "src", "generated", "prisma", "client.ts"))) {
    prismaCli(["generate"], "file:./prisma/test-template.db");
  }

  const template = path.join(prismaDir, "test-template.db");
  removeDb(template);
  prismaCli(["migrate", "deploy"], "file:./prisma/test-template.db");

  for (const name of TEST_DATABASES) {
    const target = path.join(prismaDir, `${name}.db`);
    removeDb(target);
    copyFileSync(template, target);
  }
}
