import { SendMessageDialog } from "@/components/crm/comms/SendMessageDialog";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FlagTag } from "@/components/ui/FlagTag";
import { Icon } from "@/components/ui/Icon";
import { formatLei, formatPhone, formatYears, telHref } from "@/lib/format";
import type { PatientFlag } from "@/server/patients/flags";
import type { PatientHeaderDTO } from "@/server/patients/types";

export type PatientHeaderProps = {
  patient: PatientHeaderDTO;
  flags: PatientFlag[];
  /** From `getPatientBalance`; null when the viewer has no billing access. */
  balance: { balance: number } | null;
  can: { book: boolean; message: boolean; bill: boolean };
};

/**
 * The patient file header (design system §6.8 „Fișa pacientului”): the name in Forum, age,
 * clinic and doctor, the phone as a `tel:` link, the actions, the balance, the flags (every role
 * sees them) and the patient's own words about comfort in a mustard panel.
 */
export function PatientHeader({ patient: p, flags, balance, can }: PatientHeaderProps) {
  const facts = [
    p.age !== null ? formatYears(p.age) : null,
    p.preferredLocation?.name ?? null,
    p.primaryDoctor ? `medic curant ${p.primaryDoctor.name}` : null,
    `fișa nr. ${p.fileNumber}`,
  ].filter(Boolean);
  const active = !p.anonymized;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="font-display text-h1 text-cerneala">{p.name}</h1>
        <p className="text-corp text-discret">{facts.join(", ")}</p>
      </div>

      {p.anonymized && (
        <p className="rounded-control border border-linie bg-adancit px-3 py-2 text-corp text-cerneala">
          Fișă anonimizată. Datele de identificare au fost șterse; fișa clinică și documentele financiare se păstrează.
        </p>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {p.phone ? (
            <a href={telHref(p.phone)} className="telefon inline-flex items-center gap-1.5 text-corp font-semibold text-link underline-offset-4 hover:underline">
              <Icon name="phone" size={16} />
              {formatPhone(p.phone)}
            </a>
          ) : (
            <span className="text-corp text-discret">Fără telefon</span>
          )}
          <div className="flex flex-wrap gap-2">
            {can.book && (
              <ButtonLink href={`/crm/programari/noua?pacient=${p.id}`} icon="calendar-plus">
                Programați
              </ButtonLink>
            )}
            {can.message && (p.phone || p.email) && (
              <SendMessageDialog
                patientId={p.id}
                phone={p.phone}
                email={p.email}
                defaultChannel={p.phone ? "SMS" : "EMAIL"}
                triggerLabel={p.phone ? "Trimiteți SMS" : "Trimiteți e-mail"}
              />
            )}
            {can.bill && (
              <ButtonLink href={`/crm/facturi/noua?pacient=${p.id}`} variant="secondary" icon="wallet">
                Încasați
              </ButtonLink>
            )}
          </div>
          {balance && (
            <p className="ml-auto text-corp">
              <span className="text-discret">Sold </span>
              <span className={`cifre font-semibold ${balance.balance > 0 ? "text-carmin" : "text-cerneala"}`}>
                {balance.balance < 0 ? `${formatLei(-balance.balance)} în cont` : formatLei(balance.balance)}
              </span>
            </p>
          )}
        </div>
      )}

      {flags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Atenționări">
          {flags.map((f) => (
            <li key={`${f.kind}-${f.label}`}>
              <FlagTag kind={f.kind}>{f.label}</FlagTag>
            </li>
          ))}
        </ul>
      )}

      {p.comfortNote && (
        <figure className="rounded-panou bg-mustar-pal px-4 py-3 text-corp text-cerneala">
          <figcaption className="text-mic text-mustar-text">La programare a scris:</figcaption>
          <blockquote className="mt-0.5">„{p.comfortNote}”</blockquote>
        </figure>
      )}
    </header>
  );
}
