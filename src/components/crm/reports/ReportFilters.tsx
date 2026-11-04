import Link from "next/link";
import { Button, DateInput, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CLINIC_SCOPE_LABEL } from "@/lib/labels";
import type { ReportFilterValues } from "@/server/reports/types";

/**
 * Filters of a report (`?de=&pana=&clinica=&medic=`): a plain GET form, so it works without JS
 * and every filtered view has its own URL. One row above the table (dataviz: filters scope
 * everything below them), with period presets as links.
 */

export type PeriodPreset = { label: string; de: string; pana: string };

function hrefWith(basePath: string, f: ReportFilterValues, de: string, pana: string): string {
  const qs = new URLSearchParams({ de, pana, clinica: f.clinica });
  if (f.medic) qs.set("medic", f.medic);
  return `${basePath}?${qs.toString()}`;
}

export function ReportFilters({
  basePath,
  values,
  doctors,
  doctorLocked,
  presets,
  className,
}: {
  basePath: string;
  values: ReportFilterValues;
  /** Doctors for the „Medic” filter; empty hides it. */
  doctors: { id: string; name: string }[];
  /** The user sees only their own figures: the doctor filter is shown as text. */
  doctorLocked?: string | null;
  presets: PeriodPreset[];
  className?: string;
}) {
  const clinicOptions = (Object.keys(CLINIC_SCOPE_LABEL) as (keyof typeof CLINIC_SCOPE_LABEL)[]).map((k) => ({
    value: k,
    label: CLINIC_SCOPE_LABEL[k],
  }));
  return (
    <section aria-label="Filtre" className={cn("flex flex-col gap-3 border-b border-linie pb-4", className)}>
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <DateInput label="De la" name="de" defaultValue={values.de} className="w-40" required />
        <DateInput label="Până la" name="pana" defaultValue={values.pana} className="w-40" required />
        <Select label="Clinica" name="clinica" options={clinicOptions} defaultValue={values.clinica} className="w-36" />
        {doctorLocked ? (
          <p className="pb-2 text-corp text-discret">
            Medic: <span className="font-semibold text-cerneala">{doctorLocked}</span>
          </p>
        ) : doctors.length > 0 ? (
          <Select
            label="Medic"
            name="medic"
            options={[{ value: "", label: "Toți medicii" }, ...doctors.map((d) => ({ value: d.id, label: d.name }))]}
            defaultValue={values.medic ?? ""}
            className="w-56"
          />
        ) : null}
        <Button type="submit" variant="secondary" size="m" icon="filter">
          Aplicați filtrele
        </Button>
      </form>
      <nav aria-label="Perioade" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-mic">
        <span className="text-discret">Perioade:</span>
        {presets.map((p) => {
          const current = p.de === values.de && p.pana === values.pana;
          return (
            <Link
              key={p.label}
              href={hrefWith(basePath, values, p.de, p.pana)}
              aria-current={current ? "true" : undefined}
              className={cn("text-link underline-offset-2 hover:underline", current && "font-semibold text-cerneala underline")}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
