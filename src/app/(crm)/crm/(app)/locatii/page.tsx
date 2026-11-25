import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FlagTag, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { formatPhone } from "@/lib/format";
import { minutesToHHMM } from "@/lib/time";
import { listLocations } from "@/server/locations/service";
import type { HoursRow } from "@/server/locations/schemas";

export const metadata: Metadata = { title: "Locații" };

const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

/** „Luni–Vineri 09:00–17:00, Sâmbătă închis” style summary of a week. */
function hoursLines(hours: HoursRow[]): string[] {
  const perDay = DAYS.map((_, i) =>
    hours
      .filter((h) => h.weekday === i + 1)
      .map((h) => `${minutesToHHMM(h.openMinute)}–${minutesToHHMM(h.closeMinute)}`)
      .join(", ") || "închis",
  );
  const lines: string[] = [];
  let start = 0;
  for (let i = 1; i <= 7; i++) {
    if (i === 7 || perDay[i] !== perDay[start]) {
      const label = i - 1 === start ? DAYS[start] : `${DAYS[start]}–${DAYS[i - 1].toLowerCase()}`;
      lines.push(`${label}: ${perDay[start]}`);
      start = i;
    }
  }
  return lines;
}

/** Locații: the two clinics, their hours, capacity and cabinets. Everyone reads; ADMIN edits. */
export default async function LocationsPage() {
  await requirePermission("locations.view");
  const locations = await listLocations();
  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageHeader title="Locații" subtitle="Adresele, telefoanele și programul de aici apar pe site. Programul se publică doar după confirmarea clinicii." />
      {locations.length === 0 && <EmptyState title="Nicio clinică configurată." />}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {locations.map((l) => (
          <section key={l.id} aria-labelledby={`loc-${l.id}`} className="flex flex-col gap-3 rounded-panou border border-linie p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 id={`loc-${l.id}`} className="text-h3 font-semibold">
                <Link href={`/crm/locatii/${l.id}`} className="underline-offset-2 hover:underline">
                  {l.name}
                </Link>
              </h2>
              <span className="flex flex-wrap gap-1.5">
                {!l.active && <FlagTag kind="neutral">Inactivă</FlagTag>}
                <FlagTag kind="neutral">{l.publishHours ? "Program publicat" : "Program nepublicat"}</FlagTag>
              </span>
            </div>
            <p className="text-corp">
              {l.street}, {l.city}
              <br />
              <span className="cifre">{formatPhone(l.phone)}</span>
            </p>
            <div className="text-mic">
              {l.hours.length === 0 ? (
                <p className="text-discret">Fără program introdus.</p>
              ) : (
                <ul className="cifre">
                  {hoursLines(l.hours).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-mic text-discret">
              {l.cabinets} {l.cabinets === 1 ? "cabinet activ" : "cabinete active"}, {l.sedationUnits}{" "}
              {l.sedationUnits === 1 ? "aparat" : "aparate"} de inhalosedare.
            </p>
            <Link href={`/crm/locatii/${l.id}`} className="mt-auto self-start text-link underline underline-offset-2">
              Detalii și program
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
