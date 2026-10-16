/**
 * Applies the Prisma migrations (folder `migrations/`) that the database does not have yet. It
 * keeps the same `_prisma_migrations` table as `prisma migrate deploy`, so both tools agree.
 * Run by app.js at every start; it can also be run by hand: node migrate.js
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/** better-sqlite3 as shipped in the standalone build (nested under the Prisma adapter). */
function loadSqlite() {
  const candidates = [
    path.join(__dirname, "node_modules", "@prisma", "adapter-better-sqlite3", "node_modules", "better-sqlite3"),
    "better-sqlite3",
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try the next one */
    }
  }
  throw new Error("[dental-arena] Modulul better-sqlite3 nu a putut fi încărcat. Vezi CITESTE-MA.md, „Dacă ceva nu merge”.");
}

function migrate(dbFile, dir) {
  const Database = loadSqlite();
  const db = new Database(dbFile);
  try {
    db.pragma("foreign_keys = OFF");
    db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL, "logs" TEXT, "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp, "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0)`);
    const done = new Set(
      db.prepare(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`).all().map((r) => r.migration_name),
    );
    const names = fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, "migration.sql"))).sort();
    for (const name of names) {
      if (done.has(name)) continue;
      const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const id = crypto.randomUUID();
      const run = db.transaction(() => {
        db.prepare(`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at) VALUES (?, ?, ?, ?)`).run(id, checksum, name, new Date().toISOString());
        db.exec(sql);
        db.prepare(`UPDATE "_prisma_migrations" SET finished_at = ?, applied_steps_count = 1 WHERE id = ?`).run(new Date().toISOString(), id);
      });
      run();
      console.log(`[dental-arena] Migrare aplicată: ${name}`);
    }
    db.pragma("foreign_keys = ON");
  } finally {
    db.close();
  }
}

module.exports = { migrate };

if (require.main === module) {
  const root = __dirname;
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) {
    console.error("Setați DATABASE_URL=file:/cale/catre/dental-arena.db");
    process.exit(1);
  }
  migrate(path.resolve(root, url.slice(5)), path.join(root, "migrations"));
  console.log("Baza de date este la zi.");
}
