import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReportFilters } from "@/components/crm/reports/ReportFilters";
import { ReportTable } from "@/components/crm/reports/ReportTable";
import { Breadcrumbs, buttonClasses, Icon, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import {
  parseReportFilters,
  periodPresets,
  reportAccess,
  reportDoctors,
  REPORTS,
  runReport,
} from "@/server/reports/reports";
import { isReportSlug } from "@/server/reports/types";

export async function generateMetadata({ params }: PageProps<"/crm/rapoarte/[raport]">): Promise<Metadata> {
  const { raport } = await params;
  return { title: isReportSlug(raport) ? REPORTS[raport].title : "Rapoarte" };
}

/** One report: filters (default the current month and the clinic scope), the table and a CSV link. */
export default async function ReportPage({ params, searchParams }: PageProps<"/crm/rapoarte/[raport]">) {
  const user = await requirePermission(["reports.view", "reports.operational", "reports.viewOwn"]);
  const { raport } = await params;
  if (!isReportSlug(raport)) notFound();
  const access = reportAccess(user, raport);
  if (!access.allowed) redirect("/crm/acces-interzis");

  const query = await searchParams;
  const filters = parseReportFilters(query, { scope: await getClinicScope() });
  const [report, doctors] = await Promise.all([
    runReport(raport, filters, user),
    access.ownDoctorId ? Promise.resolve([]) : reportDoctors(),
  ]);
  const ownDoctor = access.ownDoctorId
    ? ((await prisma.doctor.findUnique({ where: { id: access.ownDoctorId }, select: { publicName: true } }))?.publicName ?? null)
    : null;
  const showDoctorFilter = raport !== "conversie-cereri" && raport !== "venit-clinica" && raport !== "incasari-metoda" ? doctors : [];

  const csv = new URLSearchParams({ de: report.filters.de, pana: report.filters.pana, clinica: report.filters.clinica });
  if (report.filters.medic && !access.ownDoctorId) csv.set("medic", report.filters.medic);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ href: "/crm/rapoarte", label: "Rapoarte" }, { label: report.title }]} />}
        title={report.title}
        subtitle={`${report.description} ${capitalizeFirst(report.scopeLabel)}.`}
        actions={
          <a
            href={`/api/crm/rapoarte/${raport}?${csv.toString()}`}
            download
            className={buttonClasses({ variant: "secondary", size: "m" })}
          >
            <Icon name="download" size={18} />
            Descărcați CSV
          </a>
        }
      />
      <ReportFilters
        basePath={`/crm/rapoarte/${raport}`}
        values={report.filters}
        doctors={showDoctorFilter}
        doctorLocked={ownDoctor}
        presets={periodPresets()}
      />
      <ReportTable
        columns={report.columns}
        rows={report.rows}
        totals={report.totals}
        caption={`${report.title}, ${report.scopeLabel}`}
      />
      <p className="text-mic text-discret masura">{FOOTNOTES[raport]}</p>
    </div>
  );
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toLocaleUpperCase("ro-RO") + s.slice(1);
}

const FOOTNOTES: Record<keyof typeof REPORTS, string> = {
  "venit-medic": "Venitul vine din liniile facturilor emise în perioadă; facturile anulate nu se numără. Liniile fără medic apar la „Fără medic”.",
  "venit-serviciu": "Cantitatea și venitul vin din liniile facturilor emise în perioadă; facturile anulate nu se numără.",
  "venit-clinica": "Facturat: facturile emise în perioadă. Încasat: plățile neanulate primite în perioadă, la clinica respectivă.",
  "venit-lunar": "Facturat: facturile emise în lună. Încasat: plățile neanulate primite în lună.",
  "incasari-metoda": "Plățile neanulate primite în perioadă, inclusiv avansurile fără factură.",
  programari: "Efectuate: pacientul a sosit, este în tratament sau vizita este finalizată. Din site: programările făcute online.",
  neprezentari:
    "Rata se calculează doar pentru programările care au trecut: neprezentări împărțit la neprezentări plus vizite efectuate. Anulările nu se numără.",
  "conversie-cereri":
    "Programate: cererile convertite în pacient sau cu statusul Programat. Cererile se numără după data la care au sosit.",
};
