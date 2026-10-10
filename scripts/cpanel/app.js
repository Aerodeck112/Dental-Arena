/**
 * Startup file for cPanel → Setup Node.js App (Application startup file: app.js).
 *
 * 1. Reads the .env file next to this file (cPanel's own environment variables win).
 * 2. Creates the data folder (database + uploaded photos and documents) if it is missing.
 * 3. On the very first start, copies the initial database (clinics, doctors, services, prices).
 * 4. Applies any new database migrations, then starts the Next.js server.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(root, ".env"));
process.env.NODE_ENV = "production";

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl.startsWith("file:")) {
  console.error("[dental-arena] DATABASE_URL lipsește sau nu începe cu file:. Vezi .env.example.");
  process.exit(1);
}
const dbFile = path.resolve(root, dbUrl.slice("file:".length));
const storageDir = path.resolve(root, process.env.STORAGE_DIR || "./storage");
process.env.STORAGE_DIR = storageDir;

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.mkdirSync(storageDir, { recursive: true });

if (!fs.existsSync(dbFile)) {
  const initial = path.join(root, "initial", "dental-arena.db");
  fs.copyFileSync(initial, dbFile);
  console.log(`[dental-arena] Baza de date inițială a fost creată: ${dbFile}`);
}

require("./migrate.js").migrate(dbFile, path.join(root, "migrations"));

require("./server.js");
