import type { Metadata } from "next";
import Link from "next/link";
import { PaymentForm } from "@/components/crm/billing/PaymentForm";
import { PaymentList } from "@/components/crm/billing/PaymentList";
import { Button, ButtonLink, DataTable, DateInput, EmptyState, PageHeader, Panel, SearchField, Select } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/DataTable";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveLocations, getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { capitalize, formatDateRo, formatLei, pluralRo } from "@/lib/format";
import { CLINIC_SCOPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { addDaysISO, isValidDateISO, localDayRangeUtc, startOfWeekISO, todayISO } from "@/lib/time";
import { zId } from "@/lib/validation/common";
import { getBillingPatient, listOpenInvoices, searchBillingPatients } from "@/server/billing/patients";
import { getPaymentJournal } from "@/server/billing/payments";
import { PAYMENT_METHODS } from "@/server/billing/totals";
import type { PaymentJournal } from "@/server/billing/types";
import type { PaymentMethod } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Încasări" };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type DayRow = PaymentJournal["byDay"][number];
type LocRow = PaymentJournal["byLocation"][number];

/**
 * Încasări: the payments journal for a period in the current clinic scope, with totals per day,
 * clinic and method, the CSV of the `incasari-metoda` report, and „Înregistrați o încasare”.
 */
export default async function PaymentsPage({ searchParams }: PageProps<"/crm/incasari">) {
  const user = await requirePermission("billing.view");
  const params = await searchParams;
  const today = todayISO();
  const rawDe = one(params.de);
  const rawPana = one(params.pana);
  let de = rawDe && isValidDateISO(rawDe) ? rawDe : today;
  let pana = rawPana && isValidDateISO(rawPana) ? rawPana : de;
  if (pana < de) [de, pana] = [pana, de];
  const metodaRaw = one(params.metoda);
  const metoda = (PAYMENT_METHODS as readonly string[]).includes(metodaRaw ?? "") ? (metodaRaw as PaymentMethod) : null;
  const [scope, locationIds, locations] = await Promise.all([getClinicScope(), scopeLocationIds(), getActiveLocations()]);
  const journal = await getPaymentJournal({
    from: localDayRangeUtc(de).start,
    to: localDayRangeUtc(pana).end,
    locationIds,
    method: metoda,
  });
  const scopeLabel = scope === "ambele" ? "ambele clinici" : CLINIC_SCOPE_LABEL[scope];
  const period = de === pana ? formatDateRo(de, "full") : `${formatDateRo(de, "short")}–${formatDateRo(pana, "short")}`;
  const canCreate = can(user, "billing.create");

  // „Înregistrați o încasare”: patient search, then the form.
  const patientParam = one(params.pacient);
  const patientQ = one(params.cauta)?.trim().slice(0, 80) ?? "";
  const payPatient = canCreate && patientParam && zId.safeParse(patientParam).success ? await getBillingPatient(patientParam) : null;
  const [openInvoices, hits] = await Promise.all([
    payPatient ? listOpenInvoices(payPatient.id) : Promise.resolve([]),
    canCreate && patientQ && !payPatient ? searchBillingPatients(patientQ) : Promise.resolve([]),
  ]);

  const presets = [
    { label: "Azi", de: today, pana: today },
    { label: "Ieri", de: addDaysISO(today, -1), pana: addDaysISO(today, -1) },
    { label: "Săptămâna aceasta", de: startOfWeekISO(today), pana: today },
    { label: "Luna aceasta", de: `${today.slice(0, 8)}01`, pana: today },
  ];
  const qs = (o: Record<string, string | null | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v) u.set(k, v);
    return u.toString();
  };
  const methodCols = (metoda ? [metoda] : PAYMENT_METHODS).map((m) => ({
    key: m,
    header: PAYMENT_METHOD_LABEL[m],
    align: "right" as const,
    render: (r: DayRow | LocRow) => <span className="whitespace-nowrap">{formatLei(r.byMethod[m])}</span>,
  }));
  const dayColumns: DataTableColumn<DayRow>[] = [
    { key: "day", header: "Ziua", render: (r) => capitalize(formatDateRo(r.dateISO, "weekday")) },
    ...methodCols,
    { key: "total", header: "Total", align: "right", render: (r) => <span className="font-semibold whitespace-nowrap">{formatLei(r.total)}</span> },
  ];
  const locColumns: DataTableColumn<LocRow>[] = [
    { key: "loc", header: "Clinica", render: (r) => r.locationName },
    ...methodCols,
    { key: "total", header: "Total", align: "right", render: (r) => <span className="font-semibold whitespace-nowrap">{formatLei(r.total)}</span> },
  ];
  const methodSentence = PAYMENT_METHODS.filter((m) => journal.byMethod[m] > 0)
    .map((m) => `${PAYMENT_METHOD_LABEL[m].toLowerCase()} ${formatLei(journal.byMethod[m])}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Încasări"
        subtitle={
          journal.count === 0
            ? `Nicio încasare în ${scopeLabel}, ${period}.`
            : `Încasat ${formatLei(journal.total)} în ${scopeLabel}, ${period}, din ${pluralRo(journal.count, "plată", "plăți")}${methodSentence ? `: ${methodSentence}` : ""}.`
        }
        actions={
          <>
            {can(user, "reports.view") && (
              <ButtonLink
                href={`/api/crm/rapoarte/incasari-metoda?${qs({ de, pana, clinica: scope })}`}
                variant="secondary"
                icon="download"
                prefetch={false}
              >
                Descărcați CSV
              </ButtonLink>
            )}
            {canCreate && (
              <ButtonLink href={`/crm/incasari?${qs({ de: rawDe, pana: rawPana, metoda: metodaRaw })}#incasare-noua`} icon="wallet">
                Înregistrați o încasare
              </ButtonLink>
            )}
          </>
        }
      />

      <section aria-label="Filtre" className="flex flex-col gap-3 border-b border-linie pb-4">
        <form method="get" action="/crm/incasari" className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <DateInput label="De la" name="de" defaultValue={de} max={today} className="w-40" />
          <DateInput label="Până la" name="pana" defaultValue={pana} max={today} className="w-40" />
          <Select
            label="Metoda"
            name="metoda"
            defaultValue={metoda ?? ""}
            options={[{ value: "", label: "Toate" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))]}
            className="w-44"
          />
          <Button type="submit" variant="secondary" icon="filter">
            Aplicați filtrele
          </Button>
        </form>
        <nav aria-label="Perioade" className="flex flex-wrap gap-x-4 gap-y-1 text-corp">
          {presets.map((p) => {
            const active = p.de === de && p.pana === pana;
            return (
              <Link
                key={p.label}
                href={`/crm/incasari?${qs({ de: p.de, pana: p.pana, metoda: metoda })}`}
                aria-current={active ? "true" : undefined}
                className={active ? "font-semibold text-cerneala underline underline-offset-4" : "text-link underline underline-offset-2"}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
        <p className="text-mic text-discret">Clinica urmează selecția din bara de sus: {scopeLabel}.</p>
      </section>

      {journal.count > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Pe zile" className="min-w-0">
            <DataTable caption="Încasări pe zile" columns={dayColumns} rows={journal.byDay} rowKey={(r) => r.dateISO} />
          </Panel>
          <Panel title="Pe clinici" className="min-w-0">
            <DataTable caption="Încasări pe clinici" columns={locColumns} rows={journal.byLocation} rowKey={(r) => r.locationId} />
          </Panel>
        </div>
      )}

      <Panel title="Jurnalul plăților">
        <PaymentList
          rows={journal.rows}
          caption={`Plățile din ${period}`}
          canCancel={can(user, "billing.cancel")}
          empty={
            <EmptyState
              title={`Nicio încasare în ${scopeLabel}, ${period}. Alegeți altă perioadă sau înregistrați o încasare.`}
              action={
                de !== today || pana !== today ? (
                  <ButtonLink href="/crm/incasari" variant="secondary">
                    Vedeți ziua de azi
                  </ButtonLink>
                ) : undefined
              }
            />
          }
        />
      </Panel>

      {canCreate && (
        <Panel title="Înregistrați o încasare" className="scroll-mt-4" as="section">
          <div id="incasare-noua" className="flex flex-col gap-4">
            {payPatient ? (
              <>
                <p className="text-corp">
                  Pacient:{" "}
                  <Link href={`/crm/pacienti/${payPatient.id}/incasari`} className="font-semibold underline underline-offset-2">
                    {payPatient.name}
                  </Link>
                  , fișa nr. {payPatient.fileNumber}.{" "}
                  <Link href={`/crm/incasari?${qs({ de: rawDe, pana: rawPana })}#incasare-noua`} className="underline underline-offset-2">
                    Alt pacient
                  </Link>
                </p>
                <PaymentForm
                  patientId={payPatient.id}
                  invoices={openInvoices}
                  locations={locations.map((l) => ({ id: l.id, shortName: l.shortName }))}
                  defaultLocationId={payPatient.preferredLocationId ?? locationIds[0] ?? null}
                  today={today}
                />
              </>
            ) : (
              <>
                <form method="get" action="/crm/incasari#incasare-noua" className="flex flex-wrap items-end gap-3">
                  {rawDe && <input type="hidden" name="de" value={rawDe} />}
                  {rawPana && <input type="hidden" name="pana" value={rawPana} />}
                  <SearchField label="Pacient" name="cauta" defaultValue={patientQ} placeholder="Nume, telefon sau nr. fișă" className="w-full sm:w-80" />
                  <Button type="submit" variant="secondary" icon="search">
                    Căutați
                  </Button>
                </form>
                {patientQ && hits.length === 0 && <p className="text-corp text-discret">Niciun pacient pentru „{patientQ}”. Verificați numele sau căutați după telefon.</p>}
                {hits.length > 0 && (
                  <ul className="flex flex-col divide-y divide-linie border-y border-linie">
                    {hits.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-mic text-discret cifre">
                            , fișa nr. {p.fileNumber}
                            {p.phone ? `, ${p.phone}` : ""}
                          </span>
                        </span>
                        <ButtonLink href={`/crm/incasari?${qs({ de: rawDe, pana: rawPana, pacient: p.id })}#incasare-noua`} variant="secondary" size="s">
                          Alegeți
                        </ButtonLink>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
