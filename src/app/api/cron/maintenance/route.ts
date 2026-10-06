import { runMaintenance } from "@/server/maintenance";
import { CRON_HEADERS, isCronAuthorized, unauthorized } from "../auth";

/**
 * GET|POST /api/cron/maintenance, daily at 03:15, `Authorization: Bearer $CRON_SECRET`
 * (docs/architecture.md §4.3, §8.4). Purges expired rate-limit buckets, anonymises stale leads and
 * redacts old message bodies.
 */
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get("authorization"))) return unauthorized();
  try {
    const result = await runMaintenance(new Date());
    return Response.json(result, { headers: CRON_HEADERS });
  } catch (e) {
    console.error(`[cron/maintenance] ${e instanceof Error ? e.name : typeof e}`);
    return Response.json({ error: "Întreținerea nu a rulat. Verificați jurnalul serverului." }, { status: 500, headers: CRON_HEADERS });
  }
}

export const GET = handle;
export const POST = handle;
