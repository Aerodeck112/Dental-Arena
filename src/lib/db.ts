import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * The Prisma client (docs/architecture.md §0.1, §7.2). SQLite through better-sqlite3 in dev;
 * production on PostgreSQL swaps the adapter here (`@prisma/adapter-pg`) and nothing else.
 *
 * In development the client is cached on `globalThis`, keyed by DATABASE_URL, so hot reloads do
 * not open a new connection each time and test files with different databases never share one.
 */

function createPrismaClient(url: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { __daPrisma?: { url: string; client: PrismaClient } };

function getClient(): PrismaClient {
  const cached = globalForPrisma.__daPrisma;
  if (cached && cached.url === env.DATABASE_URL) return cached.client;
  const client = createPrismaClient(env.DATABASE_URL);
  if (env.NODE_ENV !== "production") {
    globalForPrisma.__daPrisma = { url: env.DATABASE_URL, client };
  }
  return client;
}

export const prisma: PrismaClient = getClient();

/** A transaction client, as passed to `prisma.$transaction(async (tx) => …)`. */
export type Tx = Prisma.TransactionClient;
/** Either the root client or a transaction client: services that can join a caller's transaction take `Db`. */
export type Db = PrismaClient | Tx;

export { Prisma };
