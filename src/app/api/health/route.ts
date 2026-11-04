import { prisma } from "@/lib/db";

/** Liveness and database check (docs/architecture.md §4.3): `{ ok: true, db: true }`. */
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    // The only raw SQL in the project (docs/architecture.md §0.1).
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return Response.json(
    { ok: db, db },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
