import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CnpReveal } from "@/components/crm/patients/CnpReveal";
import { PatientForm } from "@/components/crm/patients/PatientForm";
import { TagEditor } from "@/components/crm/patients/TagEditor";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { formatDateRo, formatPhone, formatYears } from "@/lib/format";
import { COMFORT_LABEL, LEAD_SOURCE_LABEL, SEX_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getPatientFormOptions, getPatientPersonal } from "@/server/patients/service";
import { listTags } from "@/server/patients/tags";

export const metadata: Metadata = { title: "Date personale" };

/** „Date personale”: identity, contact, CNP (masked, reveal audited), guardian, preferences, tags. */
export default async function PatientPersonalPage({ params }: PageProps<"/crm/pacienti/[id]/date">) {
  const user = await requirePermission("patients.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, options, tags] = await Promise.all([getPatientPersonal(id), getPatientFormOptions(), listTags()]);
  if (!patient) notFound();
  const canEdit = can(user, "patients.edit") && !patient.anonymized;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Panel title="Date personale">
          {canEdit ? (
            <PatientForm mode="edit" patient={patient} locations={options.locations} doctors={options.doctors} />
          ) : (
            <ReadOnly patient={patient} canReveal={can(user, "patients.revealCnp")} />
          )}
        </Panel>
      </div>
      <div className="flex flex-col gap-5 lg:col-span-4">
        <Panel title="Etichete">
          {canEdit ? (
            <TagEditor patientId={id} tags={tags} selected={patient.tags.map((t) => t.id)} />
          ) : (
            <p className="text-corp text-discret">{patient.tags.map((t) => t.name).join(", ") || "Nicio etichetă."}</p>
          )}
        </Panel>
        {patient.dependents.length > 0 && (
          <Panel title="Copii în grijă">
            <ul className="flex flex-col gap-1">
              {patient.dependents.map((d) => (
                <li key={d.id} className="text-corp">
                  <Link href={`/crm/pacienti/${d.id}`} className="font-semibold text-link underline underline-offset-4">
                    {d.name}
                  </Link>
                  {d.age !== null && <span className="text-discret">, {formatYears(d.age)}</span>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <p className="text-mic text-discret">Fișă creată pe {formatDateRo(patient.createdAt, "short")}.</p>
      </div>
    </div>
  );
}

function ReadOnly({ patient: p, canReveal }: { patient: NonNullable<Awaited<ReturnType<typeof getPatientPersonal>>>; canReveal: boolean }) {
  const rows: [string, ReactNode][] = [
    ["Data nașterii", p.birthDate ? formatDateRo(p.birthDate, "short") : "–"],
    ["Sex", p.sex ? SEX_LABEL[p.sex] : "–"],
    ["CNP", p.cnpLast2 && canReveal && !p.anonymized ? <CnpReveal patientId={p.id} last2={p.cnpLast2} /> : p.hasCnp ? "înregistrat" : "–"],
    ["Telefon", p.phone ? formatPhone(p.phone) : "–"],
    ["E-mail", p.email ?? "–"],
    ["Adresă", [p.street, p.city, p.county].filter(Boolean).join(", ") || "–"],
    ["Clinica preferată", p.preferredLocation?.name ?? "–"],
    ["Medic curant", p.primaryDoctor?.name ?? "–"],
    ["Aparținător", p.guardian?.name ?? "–"],
    ["Confort", p.comfortDefault ? COMFORT_LABEL[p.comfortDefault] : "–"],
    ["Sursa", p.acquisitionSource ? LEAD_SOURCE_LABEL[p.acquisitionSource] : "–"],
    ["Observații", p.notes ?? "–"],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-corp sm:grid-cols-[12rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-discret">{k}</dt>
          <dd className="text-cerneala">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
