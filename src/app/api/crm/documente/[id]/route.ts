import { getCurrentUser } from "@/lib/auth/dal";
import { isDomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { openDocumentForDownload } from "@/server/patients/documents";

/**
 * GET /api/crm/documente/[id] (docs/architecture.md §4.3): streams one patient document as an
 * attachment, with `nosniff`. Session plus `documents.view`; audited as `document.download`.
 */
export const dynamic = "force-dynamic";

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** RFC 6266: an ASCII fallback plus the UTF-8 name („Radiografie panoramică.pdf”). */
function contentDisposition(name: string): string {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/crm/documente/[id]">): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return error(401, "Sesiunea a expirat. Intrați din nou în cont.");
  if (!can(user, "documents.view")) return error(403, "Nu aveți dreptul să descărcați documente.");
  const { id } = await ctx.params;
  if (!zId.safeParse(id).success) return error(404, "Documentul nu a fost găsit.");
  try {
    const doc = await openDocumentForDownload(user, id);
    return new Response(doc.stream, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(doc.sizeBytes),
        "Content-Disposition": contentDisposition(doc.fileName),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (isDomainError(e)) return error(e.code === "FORBIDDEN" ? 403 : 404, e.message);
    console.error(`[api/crm/documente] download failed: ${e instanceof Error ? e.name : typeof e}`);
    return error(500, "Documentul nu a putut fi descărcat. Încercați din nou.");
  }
}
