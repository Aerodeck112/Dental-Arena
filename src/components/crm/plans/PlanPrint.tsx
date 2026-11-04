import { Logo } from "@/components/brand/Logo";
import { formatDateRo, formatLei, formatPhone } from "@/lib/format";
import { PLAN_ITEM_STATUS_LABEL, PLAN_STATUS_LABEL } from "@/lib/labels";
import type { PlanDetailDTO } from "@/server/patients/types";
import { PlanTotals } from "./PlanTotals";

export type PlanPrintClinic = {
  displayName: string;
  legalName: string;
  cui: string;
  email: string;
  location: { name: string; address: string; phone: string | null } | null;
};

/** „[de completat]” placeholders from the settings stay visible so nobody prints them by mistake. */
function Val({ v }: { v: string }) {
  return v.startsWith("[") ? <span className="rounded-bloc border border-dashed border-carmin px-1 text-carmin">{v}</span> : <>{v}</>;
}

/**
 * The printable deviz (A4): clinic header, patient, lines by phase with prices, totals, a validity
 * note and the signature lines. Uses the light palette in print (globals.css).
 */
export function PlanPrint({
  plan,
  clinic,
  patient,
  today,
}: {
  plan: PlanDetailDTO;
  clinic: PlanPrintClinic;
  patient: { name: string; fileNumber: number; birthDate: string | null; phone: string | null };
  today: string;
}) {
  const items = plan.items.filter((i) => i.status !== "ANULAT");
  const phases = [...new Set(items.map((i) => i.phase))].sort((a, b) => a - b);
  const ordered = phases.flatMap((ph) => items.filter((i) => i.phase === ph));
  const lineNo = new Map(ordered.map((i, n) => [i.id, n + 1]));
  return (
    <article className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 rounded-panou border border-linie bg-suprafata p-5 text-corp text-cerneala sm:p-8 print:max-w-none print:border-0 print:p-0">
      <header className="grid items-start gap-6 border-b border-linie pb-5 sm:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col items-start gap-3">
          <Logo variant="compact" className="h-10 w-auto" />
          <div className="flex flex-col gap-0.5 text-mic">
            <p className="font-semibold">
              <Val v={clinic.legalName} />
            </p>
            <p>
              CUI <Val v={clinic.cui} />
            </p>
            {clinic.location && (
              <p>
                {clinic.displayName} {clinic.location.name}, {clinic.location.address}
                {clinic.location.phone ? `, tel. ${formatPhone(clinic.location.phone)}` : ""}
              </p>
            )}
            <p>{clinic.email}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:text-right print:text-right">
          <h1 className="font-display text-h1">Deviz</h1>
          <p className="text-mic">Plan de tratament: {plan.title}</p>
          <p className="text-mic">Data: {formatDateRo(today, "short")}</p>
          <p className="text-mic">Status: {PLAN_STATUS_LABEL[plan.status]}</p>
        </div>
      </header>

      <section className="grid gap-1 text-mic sm:grid-cols-2 print:grid-cols-2">
        <p>
          <span className="text-discret">Pacient: </span>
          <span className="font-semibold">{patient.name}</span>, fișa nr. {patient.fileNumber}
        </p>
        <p>
          {patient.birthDate ? `Născut(ă) ${formatDateRo(patient.birthDate, "short")}` : ""}
          {patient.phone ? `${patient.birthDate ? ", " : ""}tel. ${formatPhone(patient.phone)}` : ""}
        </p>
        {plan.doctor && (
          <p>
            <span className="text-discret">Medic: </span>
            {plan.doctor.name}
          </p>
        )}
      </section>

      <table className="w-full text-mic">
        <caption className="sr-only">Lucrările devizului</caption>
        <thead>
          <tr className="border-b border-cerneala text-left">
            <th scope="col" className="py-1.5 pr-2">Nr.</th>
            <th scope="col" className="py-1.5 pr-2">Lucrare</th>
            <th scope="col" className="py-1.5 pr-2">Dinte</th>
            <th scope="col" className="py-1.5 pr-2 text-right">Cant.</th>
            <th scope="col" className="py-1.5 pr-2 text-right">Preț unitar</th>
            <th scope="col" className="py-1.5 pr-2 text-right">Reducere</th>
            <th scope="col" className="py-1.5 text-right">Valoare</th>
          </tr>
        </thead>
        {phases.map((ph) => (
          <tbody key={ph}>
            {phases.length > 1 && (
              <tr>
                <th scope="rowgroup" colSpan={7} className="pt-3 pb-1 text-left font-semibold">
                  Faza {ph}
                </th>
              </tr>
            )}
            {items
              .filter((i) => i.phase === ph)
              .map((i) => (
                <tr key={i.id} className="border-b border-linie align-top">
                  <td className="cifre py-1.5 pr-2">{lineNo.get(i.id)}</td>
                  <td className="py-1.5 pr-2">
                    {i.description}
                    {i.status === "EFECTUAT" && <span className="text-discret"> ({PLAN_ITEM_STATUS_LABEL.EFECTUAT.toLowerCase()})</span>}
                  </td>
                  <td className="cifre py-1.5 pr-2">
                    {i.tooth ?? "–"}
                    {i.surfaces ? ` ${i.surfaces}` : ""}
                  </td>
                  <td className="cifre py-1.5 pr-2 text-right">{i.quantity}</td>
                  <td className="cifre py-1.5 pr-2 text-right whitespace-nowrap">{formatLei(i.unitPrice)}</td>
                  <td className="cifre py-1.5 pr-2 text-right whitespace-nowrap">{i.discount > 0 ? `− ${formatLei(i.discount)}` : "–"}</td>
                  <td className="cifre py-1.5 text-right whitespace-nowrap">{formatLei(i.total)}</td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>

      <PlanTotals totals={plan.totals} />

      <div className="flex flex-col gap-1 text-mic text-discret">
        <p>Prețurile sunt valabile 30 de zile de la data devizului. Planul se poate modifica după evoluția tratamentului, numai cu acordul dumneavoastră.</p>
        {plan.notes && <p className="whitespace-pre-line text-cerneala">{plan.notes}</p>}
      </div>

      <footer className="grid grid-cols-2 gap-10 pt-10" data-print="intreg">
        <div className="flex flex-col gap-1">
          <div className="h-12 border-b border-cerneala" />
          <p className="text-mic">Semnătura și parafa medicului</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-12 border-b border-cerneala" />
          <p className="text-mic">Semnătura pacientului (sau a aparținătorului)</p>
        </div>
      </footer>
    </article>
  );
}
