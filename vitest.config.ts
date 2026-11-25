import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test configuration (docs/architecture.md §11.1 rule 6).
 *
 * - Unit tests live in `__tests__/` folders next to the code.
 * - Integration tests use a temporary SQLite file. The global setup migrates
 *   `prisma/test.db` (the default below) and one file per work package,
 *   `prisma/test-wp1.db` … `prisma/test-wp8.db`. A test file picks its own file by
 *   setting `process.env.DATABASE_URL` inside `vi.hoisted()` before importing `@/lib/db`.
 * - `server-only` resolves to its empty module, so server modules can be unit-tested.
 * - Every variable validated by `src/lib/env.ts` gets a test value here, so tests never
 *   read the developer's `.env` and never touch `prisma/dev.db`.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.join(root, "src/$1") },
      { find: /^server-only$/, replacement: path.join(root, "node_modules/server-only/empty.js") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}", "prisma/**/__tests__/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      AUTH_SECRET: "test-secret-pentru-vitest-0123456789-abcdefghijkl",
      PII_ENCRYPTION_KEY: "dGVzdC1rZXktcGVudHJ1LXZpdGVzdC0zMi1vY3RldGk=",
      APP_URL: "http://localhost:3000",
      SMTP_HOST: "",
      SMTP_PORT: "587",
      SMTP_USER: "",
      SMTP_PASS: "",
      MAIL_FROM: "Dental Arena <office@dentalarena.ro>",
      CLINIC_NOTIFY_EMAIL: "office@dentalarena.ro",
      SMS_PROVIDER: "console",
      CRON_SECRET: "test-cron-secret",
      STORAGE_DIR: "./storage/test",
      EINVOICE_PROVIDER: "none",
      TZ: "UTC",
    },
  },
});
