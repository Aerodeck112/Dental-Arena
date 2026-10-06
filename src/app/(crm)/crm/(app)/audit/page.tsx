import type { Metadata } from "next";
import { AuditTable, type AuditRow } from "@/components/crm/audit/AuditTable";
import { Button, ButtonLink, DateInput, EmptyState, PageHeader, Pagination, Select, TextField } from "@/components/ui";
import { AUDIT_ACTION_LABEL, type AuditAction } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { APPOINTMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL, ROLE_LABEL } from "@/lib/labels";
import { normalizeSearch } from "@/lib/search";
import { isValidDateISO, localDayRangeUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Jurnal de audit" };

const PAGE_SIZE = 50;

const ENTITY_LABEL: Record<string, string> = {
  Patient: "Pacient",
  Appointment: "Programare",
  Lead: "Cerere",
  Invoice: "Factură",
  Payment: "Încasare",
  User: "Utilizator",
  Doctor: "Medic",
  Setting: "Setare",
  MessageTemplate: "Șablon de mesaj",
  Report: "Raport",
  PatientDocument: "Document",
  TreatmentPlan: "Plan de tratament",
  Consent: "Consimțământ",
  DataRequest: "Cerere GDPR",
  Service: "Serviciu",
  ServiceCategory: "Categorie de servicii",
  WorkShift: "Program",
  TimeOff: "Absență",
  Location: "Locație",
  MedicalHistory: "Anamneză",
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  Patient: (id) => `/crm/pacienti/${id}`,
  Appointment: (id) => `/crm/programari/${id}`,
  Lead: (id) => `/crm/cereri/${id}`,
  Invoice: (id) => `/crm/facturi/${id}`,
  MessageTemplate: (id) => `/crm/mesaje/sabloane/${id}`,
  Report: (id) => `/crm/rapoarte/${id}`,
};

/** Romanian names of the metadata keys the services write. Unknown keys are shown as written. */
const METADATA_KEY_LABEL: Record<string, string> = {
  fields: "câmpuri",
  from: "din",
  to: "în",
  via: "prin",
  method: "metodă",
  reason: "motiv",
  key: "cheie",
  reset: "revenire la textul implicit",
  report: "raport",
  de: "de la",
  pana: "până la",
  clinica: "clinica",
  medic: "medic",
  rows: "rânduri",
  format: "format",
};

function metadataValue(key: string, v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => metadataValue(key, x)).join(", ");
  if (typeof v === "boolean") return v ? "da" : "nu";
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if ((key === "from" || key === "to") && s in APPOINTMENT_STATUS_LABEL) return APPOINTMENT_STATUS_LABEL[s as keyof typeof APPOINTMENT_STATUS_LABEL];
  if (key === "method" && s in PAYMENT_METHOD_LABEL) return PAYMENT_METHOD_LABEL[s as keyof typeof PAYMENT_METHOD_LABEL];
  return s;
}

/** Metadata JSON → „câmpuri: a, b; din: Confirmat” (field names and ids only, by contract). */
function describeMetadata(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const parts = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${METADATA_KEY_LABEL[k] ?? k}: ${metadataValue(k, v)}`);
    const text = parts.join("; ");
    return text.length > 220 ? `${text.slice(0, 219)}…` : text || null;
  } catch {
    return null;
  }
}

function one(params: Record<string, string | string[] | undefined>, k: string): string | undefined {
  const v = params[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

/** Jurnal de audit: ADMIN only, filters (actor, action, patient, date), paginated, read-only. */
export default async function AuditPage({ searchParams }: PageProps<"/crm/audit">) {
  await requirePermission("audit.view");
  const params = await searchParams;
  const actorId = one(params, "actor");
  const actionRaw = one(params, "actiune");
  const action = actionRaw && actionRaw in AUDIT_ACTION_LABEL ? (actionRaw as AuditAction) : undefined;
  const patientQuery = one(params, "pacient");
  const deRaw = one(params, "de");
  const panaRaw = one(params, "pana");
  const de = deRaw && isValidDateISO(deRaw) ? deRaw : undefined;
  const pana = panaRaw && isValidDateISO(panaRaw) ? panaRaw : undefined;
  const pageRaw = Number.parseInt(one(params, "pagina") ?? "1", 10);

  // Patient filter: file number („124”) or name / phone, through the normalised search column.
  let patientIds: string[] | undefined;
  if (patientQuery) {
    const n = Number.parseInt(patientQuery.replace(/^#/, ""), 10);
    const matches = /^#?\d+$/.test(patientQuery)
      ? await prisma.patient.findMany({ where: { fileNumber: n }, select: { id: true }, take: 1 })
      : await prisma.patient.findMany({ where: { searchText: { contains: normalizeSearch(patientQuery) } }, select: { id: true }, take: 200 });
    patientIds = matches.map((m) => m.id);
  }

  const at: { gte?: Date; lt?: Date } = {};
  if (de) at.gte = localDayRangeUtc(de).start;
  if (pana) at.lt = localDayRangeUtc(pana).end;
  const where = {
    ...(actorId === "sistem" ? { actorId: null } : actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(patientIds ? { patientId: { in: patientIds } } : {}),
    ...(de || pana ? { at } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, pageCount) : 1;
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, at: true, actorName: true, actorRole: true, action: true, entityType: true, entityId: true, patientId: true, metadata: true },
  });
  const linkedPatients = [...new Set(logs.map((l) => l.patientId).filter((x): x is string => Boolean(x)))];
  const patients = linkedPatients.length
    ? await prisma.patient.findMany({
        where: { id: { in: linkedPatients } },
        select: { id: true, fileNumber: true, firstName: true, lastName: true },
      })
    : [];
  const patientLabel = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}, fișa ${p.fileNumber}`]));

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    at: l.at.toISOString(),
    actor: l.actorName ?? "Sistem sau pacient (link)",
    actorRole: l.actorRole ? ROLE_LABEL[l.actorRole] : null,
    action: l.action,
    actionLabel: AUDIT_ACTION_LABEL[l.action as AuditAction] ?? l.action,
    entity: ENTITY_LABEL[l.entityType] ?? l.entityType,
    entityHref: l.entityId && ENTITY_HREF[l.entityType] ? ENTITY_HREF[l.entityType](l.entityId) : null,
    patient: l.patientId ? { id: l.patientId, label: patientLabel.get(l.patientId) ?? "Pacient" } : null,
    details: describeMetadata(l.metadata),
  }));

  const filtered = Boolean(actorId || action || patientQuery || de || pana);
  const actionOptions = (Object.keys(AUDIT_ACTION_LABEL) as AuditAction[])
    .map((a) => ({ value: a, label: AUDIT_ACTION_LABEL[a] }))
    .sort((a, b) => a.label.localeCompare(b.label, "ro"));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Jurnal de audit"
        subtitle="Cine a văzut sau a modificat date și când. Înregistrările nu pot fi modificate sau șterse."
      />
      <form method="get" action="/crm/audit" aria-label="Filtre" className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-linie pb-4">
        <Select
          label="Cine"
          name="actor"
          className="w-52"
          defaultValue={actorId ?? ""}
          options={[
            { value: "", label: "Toți" },
            { value: "sistem", label: "Sistem sau pacient (link)" },
            ...users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
          ]}
        />
        <Select label="Acțiune" name="actiune" className="w-56" defaultValue={action ?? ""} options={[{ value: "", label: "Toate" }, ...actionOptions]} />
        <TextField
          label="Pacient"
          name="pacient"
          className="w-56"
          defaultValue={patientQuery ?? ""}
          placeholder="Nume, telefon sau nr. fișă"
          type="search"
        />
        <DateInput label="De la" name="de" className="w-40" defaultValue={de ?? ""} />
        <DateInput label="Până la" name="pana" className="w-40" defaultValue={pana ?? ""} />
        <Button type="submit" variant="secondary" icon="filter">
          Aplicați filtrele
        </Button>
        {filtered && (
          <ButtonLink href="/crm/audit" variant="text">
            Ștergeți filtrele
          </ButtonLink>
        )}
      </form>
      <p className="text-mic text-discret cifre" aria-live="polite">
        {total === 0 ? "Nicio înregistrare" : `${total} ${total === 1 ? "înregistrare" : total % 100 >= 20 || total % 100 === 0 ? "de înregistrări" : "înregistrări"}`}
        {filtered ? " pentru filtrele alese." : "."}
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title={
            filtered
              ? "Nicio înregistrare pentru filtrele alese. Schimbați perioada sau ștergeți filtrele."
              : "Jurnalul este gol. Autentificările și modificările apar aici pe măsură ce au loc."
          }
          action={
            filtered ? (
              <ButtonLink href="/crm/audit" variant="secondary">
                Ștergeți filtrele
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <AuditTable rows={rows} />
      )}
      <Pagination page={page} pageCount={pageCount} baseHref="/crm/audit" searchParams={params} />
    </div>
  );
}
