import type { Metadata } from "next";
import { MessageLogTable } from "@/components/crm/comms/MessageLogTable";
import { SendMessageDialog } from "@/components/crm/comms/SendMessageDialog";
import { Button, ButtonLink, DateInput, EmptyState, PageHeader, Pagination, Select } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { MESSAGE_CHANNEL_LABEL, MESSAGE_KIND_LABEL, MESSAGE_STATUS_LABEL, labelOptions } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { isSmtpConfigured } from "@/server/notify/mailer";
import { listMessageLog, parseMessageLogFilters } from "@/server/notify/log";
import { getSmsProvider } from "@/server/notify/sms";

export const metadata: Metadata = { title: "Mesaje" };

/** Mesaje: the log of every SMS and e-mail (filters: channel, kind, status, date) and manual send. */
export default async function MessagesPage({ searchParams }: PageProps<"/crm/mesaje">) {
  const user = await requirePermission("messages.view");
  const params = await searchParams;
  const f = parseMessageLogFilters(params);
  const { rows, total, pageCount } = await listMessageLog(f);
  const filtered = Boolean(f.canal || f.tip || f.status || f.de || f.pana);
  const mailSimulated = !isSmtpConfigured();
  const smsSimulated = getSmsProvider().simulated;
  const simulatedNote =
    mailSimulated && smsSimulated
      ? "E-mailurile și SMS-urile sunt simulate: serverul de e-mail și furnizorul de SMS nu sunt configurate încă."
      : mailSimulated
        ? "E-mailurile sunt simulate: serverul de e-mail nu este configurat încă."
        : smsSimulated
          ? "SMS-urile sunt simulate: furnizorul de SMS nu este configurat încă."
          : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mesaje"
        subtitle={
          total === 0
            ? "Jurnalul SMS-urilor și e-mailurilor trimise pacienților și clinicii."
            : `${total} ${total === 1 ? "mesaj" : total % 100 >= 20 || total % 100 === 0 ? "de mesaje" : "mesaje"}${filtered ? " pentru filtrele alese" : " în jurnal"}.`
        }
        actions={
          <>
            {can(user, "templates.manage") && (
              <ButtonLink href="/crm/mesaje/sabloane" variant="secondary" icon="pencil">
                Șabloane
              </ButtonLink>
            )}
            {can(user, "messages.send") && <SendMessageDialog triggerVariant="primary" />}
          </>
        }
      />

      {simulatedNote && (
        <p className="rounded-panou bg-menta-pal px-4 py-3 text-corp masura">
          {simulatedNote} Mesajele apar în jurnal cu statusul Simulat.
        </p>
      )}

      <form method="get" action="/crm/mesaje" aria-label="Filtre" className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-linie pb-4">
        <Select label="Canal" name="canal" className="w-32" defaultValue={f.canal ?? ""} options={[{ value: "", label: "Toate" }, ...labelOptions(MESSAGE_CHANNEL_LABEL)]} />
        <Select label="Tip" name="tip" className="w-56" defaultValue={f.tip ?? ""} options={[{ value: "", label: "Toate" }, ...labelOptions(MESSAGE_KIND_LABEL)]} />
        <Select label="Status" name="status" className="w-32" defaultValue={f.status ?? ""} options={[{ value: "", label: "Toate" }, ...labelOptions(MESSAGE_STATUS_LABEL)]} />
        <DateInput label="De la" name="de" className="w-40" defaultValue={f.de ?? ""} />
        <DateInput label="Până la" name="pana" className="w-40" defaultValue={f.pana ?? ""} />
        <Button type="submit" variant="secondary" icon="filter">
          Aplicați filtrele
        </Button>
        {filtered && (
          <ButtonLink href="/crm/mesaje" variant="text">
            Ștergeți filtrele
          </ButtonLink>
        )}
      </form>

      <MessageLogTable
        rows={rows}
        empty={
          <EmptyState
            title={
              filtered
                ? "Niciun mesaj pentru filtrele alese. Schimbați perioada sau ștergeți filtrele."
                : "Niciun mesaj încă. Reamintirile și confirmările apar aici imediat ce sunt trimise."
            }
            action={
              filtered ? (
                <ButtonLink href="/crm/mesaje" variant="secondary">
                  Ștergeți filtrele
                </ButtonLink>
              ) : undefined
            }
          />
        }
      />
      <Pagination page={f.pagina} pageCount={pageCount} baseHref="/crm/mesaje" searchParams={params} />
    </div>
  );
}
