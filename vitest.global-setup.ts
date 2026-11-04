import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vitest global setup (docs/architecture.md §11.1 rule 6).
 *
 * Migrates one template SQLite database with `prisma migrate deploy`, then copies it to
 * `prisma/test.db` (the default `DATABASE_URL` in vitest.config.ts) and to one file per work
 * package, `prisma/test-wp1.db` … `prisma/test-wp8.db`. Each test file is responsible for its own
 * data.
 *
 * Several builders may run `npm test` in the same tree at once. Replacing a database file under a
 * running test makes SQLite fail with SQLITE_READONLY_DBMOVED, so the databases are only recreated
 * when no other test run is active:
 * - every run registers itself in `node_modules/.cache/dental-arena-tests/runs/<pid>` (stale
 *   entries of dead processes are swept);
 * - the check-and-recreate step happens under a mutex (`runs.lock` next to it, created with `wx`,
 *   so it is atomic);
 * - a run that starts while another is active shares the already migrated databases.
 */
const root = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.join(root, "prisma");
// Run registry and mutex live in node_modules/.cache, which git ignores.
const stateDir = path.join(root, "node_modules", ".cache", "dental-arena-tests");
const runsDir = path.join(stateDir, "runs");
const mutexFile = path.join(stateDir, "runs.lock");
const TEST_DATABASES = ["test", ...Array.from({ length: 8 }, (_, i) => `test-wp${i + 1}`)];
const MUTEX_TIMEOUT_MS = 180_000;

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

function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Atomically creates the mutex file; waits while a live process holds it, breaks a stale one. */
async function acquireMutex(): Promise<void> {
  mkdirSync(stateDir, { recursive: true });
  const deadline = Date.now() + MUTEX_TIMEOUT_MS;
  for (;;) {
    try {
      writeFileSync(mutexFile, String(process.pid), { flag: "wx" });
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    let holder = 0;
    try {
      holder = Number(readFileSync(mutexFile, "utf8"));
    } catch {
      continue; // released meanwhile
    }
    if (!holder && Date.now() <= deadline) {
      await sleep(50); // the holder has created the file but not written its pid yet
      continue;
    }
    if (!isAlive(holder) || Date.now() > deadline) {
      rmSync(mutexFile, { force: true });
      continue;
    }
    await sleep(100);
  }
}

function releaseMutex() {
  try {
    if (Number(readFileSync(mutexFile, "utf8")) === process.pid) rmSync(mutexFile, { force: true });
  } catch {
    // already gone
  }
}

/** Live test runs other than this one; removes the entries of processes that have exited. */
function otherLiveRuns(): number[] {
  mkdirSync(runsDir, { recursive: true });
  const others: number[] = [];
  for (const name of readdirSync(runsDir)) {
    const pid = Number(name);
    if (pid === process.pid) continue;
    if (isAlive(pid)) others.push(pid);
    else rmSync(path.join(runsDir, name), { force: true });
  }
  return others;
}

function recreateDatabases() {
  const template = path.join(prismaDir, "test-template.db");
  removeDb(template);
  prismaCli(["migrate", "deploy"], "file:./prisma/test-template.db");
  for (const name of TEST_DATABASES) {
    const target = path.join(prismaDir, `${name}.db`);
    const tmp = path.join(stateDir, `${name}.db.tmp-${process.pid}`);
    copyFileSync(template, tmp);
    removeDb(target);
    renameSync(tmp, target);
  }
}

/** Shared mode: only fills in databases that are missing, never replaces one in use. */
function ensureDatabases() {
  for (const name of TEST_DATABASES) {
    const file = `file:./prisma/${name}.db`;
    if (!existsSync(path.join(prismaDir, `${name}.db`))) prismaCli(["migrate", "deploy"], file);
  }
}

export default async function setup() {
  if (!existsSync(path.join(root, "src", "generated", "prisma", "client.ts"))) {
    prismaCli(["generate"], "file:./prisma/test-template.db");
  }

  const entry = path.join(runsDir, String(process.pid));
  await acquireMutex();
  try {
    const others = otherLiveRuns();
    writeFileSync(entry, new Date().toISOString());
    if (others.length === 0) recreateDatabases();
    else ensureDatabases();
  } catch (e) {
    rmSync(entry, { force: true });
    throw e;
  } finally {
    releaseMutex();
  }

  return () => {
    rmSync(entry, { force: true });
  };
}
