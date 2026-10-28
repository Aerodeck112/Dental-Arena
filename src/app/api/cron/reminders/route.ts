import { runReminders } from "@/server/notify/reminders";
import { CRON_HEADERS, isCronAuthorized, unauthorized } from "../auth";

/**
 * GET|POST /api/cron/reminders, hourly, `Authorization: Bearer $CRON_SECRET`
 * (docs/architecture.md §4.3, §6.6). Sends the 24h reminders and returns a summary. Idempotent.
 */
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get("authorization"))) return unauthorized();
  try {
    const result = await runReminders(new Date());
    return Response.json(result, { headers: CRON_HEADERS });
  } catch (e) {
    console.error(`[cron/reminders] ${e instanceof Error ? e.name : typeof e}`);
    return Response.json({ error: "Reamintirile nu au putut fi trimise. Verificați jurnalul serverului." }, { status: 500, headers: CRON_HEADERS });
  }
}

export const GET = handle;
export const POST = handle;
