import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { getClinicScope } from "@/lib/clinic-scope";
import { csvFilename, reportToCsv } from "@/server/reports/csv";
import { parseReportFilters, reportAccess, runReport } from "@/server/reports/reports";
import { isReportSlug } from "@/server/reports/types";

/**
 * GET /api/crm/rapoarte/[raport]?de=&pana=&clinica=&medic= (docs/architecture.md §4.3): the
 * report as CSV for Excel (UTF-8 with BOM, `;`). Session plus the report's permission (§5.3);
 * every download is audited as `report.export`.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function GET(request: Request, ctx: RouteContext<"/api/crm/rapoarte/[raport]">): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return error(401, "Sesiunea a expirat. Intrați din nou în cont.");
  const { raport } = await ctx.params;
  if (!isReportSlug(raport)) return error(404, "Raportul nu există.");
  if (!reportAccess(user, raport).allowed) {
    return error(403, "Nu aveți acces la acest raport. Cereți-i administratorului drepturile necesare.");
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = parseReportFilters(params, { scope: await getClinicScope() });
  try {
    const report = await runReport(raport, filters, user);
    await audit(
      {
        action: "report.export",
        entityType: "Report",
        entityId: raport,
        metadata: { report: raport, de: report.filters.de, pana: report.filters.pana, clinica: report.filters.clinica, medic: report.filters.medic, rows: report.rows.length },
      },
      { actor: user },
    );
    const filename = csvFilename(report);
    return new Response(reportToCsv(report), {
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error(`[api/crm/rapoarte] ${e instanceof Error ? e.name : typeof e}`);
    return error(500, "Raportul nu a putut fi generat. Încercați din nou.");
  }
}
