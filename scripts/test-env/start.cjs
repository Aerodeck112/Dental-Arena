/**
 * Start of the test copy (Dockerfile.test, docs/mediu-test.md).
 *
 * 1. Fills in what a test copy needs without any setup: secrets made on the first start and kept
 *    next to the database, the public address Render gives the service, e-mail only in the log.
 * 2. Creates the database with the clinics, doctors, prices and the demo patients, dated from today.
 * 3. Starts the Next.js server.
 *
 * Every variable set in the hosting panel wins over these defaults.
 */
"use strict";
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
fs.mkdirSync(dataDir, { recursive: true });

// The encryption key must stay the same as long as the database lives, so it is kept beside it.
const secretsFile = path.join(dataDir, ".secrete.json");
let secrets;
if (fs.existsSync(secretsFile)) {
  secrets = JSON.parse(fs.readFileSync(secretsFile, "utf8"));
} else {
  secrets = {
    AUTH_SECRET: crypto.randomBytes(48).toString("base64url"),
    PII_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
    CRON_SECRET: crypto.randomBytes(24).toString("base64url"),
  };
  fs.writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
}

const port = process.env.PORT || "10000";
const defaults = {
  ...secrets,
  NODE_ENV: "production",
  SITE_MODE: "test",
  DATABASE_URL: `file:${path.join(dataDir, "dental-arena.db")}`,
  STORAGE_DIR: path.join(dataDir, "storage"),
  APP_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`,
  MAIL_FROM: "Dental Arena <office@dentalarena.ro>",
  CLINIC_NOTIFY_EMAIL: "office@dentalarena.ro",
  SMS_PROVIDER: "console",
  EINVOICE_PROVIDER: "none",
  SEED_DEMO: "1",
};
for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}
fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
// The seed runs through tsx, from the project's own node_modules.
process.env.PATH = `${path.join(root, "node_modules/.bin")}${path.delimiter}${process.env.PATH || ""}`;

const prisma = (...args) =>
  execFileSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
console.log("[mediu-test] Baza de date: actualizări și date demonstrative");
prisma("migrate", "deploy");
prisma("db", "seed");

console.log(`[mediu-test] Pornire pe ${process.env.APP_URL}`);
const standalone = path.join(root, ".next/standalone");
process.chdir(standalone);
require(path.join(standalone, "server.js"));
