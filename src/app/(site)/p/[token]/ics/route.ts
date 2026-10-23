import { type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/request";
import { icsForToken } from "@/server/scheduling/links";

/**
 * GET /p/[token]/ics (docs/architecture.md §4.1, §6.6): the appointment as an iCalendar file.
 * Read-only. Tampered, expired and stale links get a 404 with the invalid-link message.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/p/[token]/ics">) {
  const { token } = await ctx.params;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

  const limit = await rateLimit(`token:ip:${await getIpHash()}`, 20, 600);
  if (!limit.ok) {
    return new Response("Ați trimis prea multe cereri. Încercați din nou peste câteva minute sau sunați-ne.", {
      status: 429,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(limit.retryAfterSec) },
    });
  }

  const file = await icsForToken(decodeURIComponent(token));
  if (!file) {
    return new Response("Linkul nu mai este valabil. Pentru modificări sunați la clinică.", {
      status: 404,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(file.body, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
