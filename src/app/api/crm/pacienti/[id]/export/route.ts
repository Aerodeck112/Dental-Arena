import { getCurrentUser } from "@/lib/auth/dal";
import { isDomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { exportPatientData } from "@/server/patients/gdpr";

/**
 * GET /api/crm/pacienti/[id]/export (docs/architecture.md §4.3, §8.4): the GDPR export of one
 * patient as a JSON download. Session plus `gdpr.manage` (ADMIN); audited as `patient.export`.
 */
export const dynamic = "force-dynamic";

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, ctx: RouteContext<"/api/crm/pacienti/[id]/export">): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return error(401, "Sesiunea a expirat. Intrați din nou în cont.");
  if (!can(user, "gdpr.manage")) return error(403, "Doar administratorii pot exporta datele unui pacient.");
  const { id } = await ctx.params;
  if (!zId.safeParse(id).success) return error(404, "Pacientul nu a fost găsit.");
  try {
    const { fileName, data } = await exportPatientData(user, id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (isDomainError(e)) return error(e.code === "FORBIDDEN" ? 403 : 404, e.message);
    console.error(`[api/crm/export] failed: ${e instanceof Error ? e.name : typeof e}`);
    return error(500, "Exportul nu a putut fi generat. Încercați din nou.");
  }
}
