import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/request";
import { getAvailableSlots, resolvePublicSlotParams } from "@/server/scheduling/availability";
import { slotsQuerySchema } from "@/server/leads/schemas";

/**
 * GET /api/public/slots?clinica=&serviciu=&medic=&de=YYYY-MM-DD&zile=7 (docs/architecture.md §4.3).
 * Free online slots for the booking wizard as `DaySlots[]`. Rate-limited to 60 per minute per IP.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function error(status: number, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ error: message }, { status, headers: { ...NO_STORE, ...headers } });
}

export async function GET(request: NextRequest) {
  const limit = await rateLimit(`slots:ip:${await getIpHash()}`, 60, 60);
  if (!limit.ok) {
    return error(429, "Ați trimis prea multe cereri. Încercați din nou peste câteva minute sau sunați-ne.", {
      "Retry-After": String(limit.retryAfterSec),
    });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = slotsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return error(400, "Parametri invalizi. Folosiți clinica, serviciu, de (AAAA-LL-ZZ) și, opțional, medic și zile (1–14).");
  }
  const q = parsed.data;
  const resolved = await resolvePublicSlotParams({ clinica: q.clinica, serviciu: q.serviciu, medic: q.medic });
  if ("error" in resolved) return error(400, resolved.error);

  try {
    const days = await getAvailableSlots({
      locationId: resolved.locationId,
      serviceId: resolved.serviceId,
      doctorId: resolved.doctorId,
      fromDateISO: q.de,
      days: q.zile ?? 7,
      channel: "online",
    });
    return NextResponse.json(days, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof RangeError) return error(400, "Data nu este validă. Folosiți formatul AAAA-LL-ZZ.");
    console.error(`[api/public/slots] ${e instanceof Error ? e.name : typeof e}`);
    return error(500, "Orele libere nu au putut fi încărcate. Sunați-ne și vă găsim o oră.");
  }
}
