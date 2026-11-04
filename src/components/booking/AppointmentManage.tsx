"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ActionResult } from "@/lib/actions";
import { formatPhone, telHref } from "@/lib/format";
import type { ManagedAppointment } from "@/server/scheduling/links";
import { cancelByLink, confirmByLink } from "@/app/(site)/p/[token]/actions";

type Result = ActionResult<ManagedAppointment> | null;

function PhoneLine({ a }: { a: ManagedAppointment }) {
  return (
    <a
      href={telHref(a.phone)}
      aria-label={`Sunați la ${a.locationShortName}, ${formatPhone(a.phone)}`}
      className="inline-flex min-h-control items-center gap-2 text-corp font-medium text-cerneala underline decoration-linie-control underline-offset-[0.25em] hover:decoration-current"
    >
      <Icon name="phone" size={20} className="text-discret" />
      {a.locationShortName} <span className="telefon">{formatPhone(a.phone)}</span>
    </a>
  );
}

/**
 * The patient's own view of one appointment (`/p/[token]`, docs/architecture.md §6.6): first name,
 * date, time, clinic, address and doctor, with „Confirm programarea” and „Anulez programarea” as
 * POST forms (Server Actions). Both work before JavaScript loads; with JavaScript, cancelling
 * asks once more before it happens.
 */
export function AppointmentManage({ token, appointment }: { token: string; appointment: ManagedAppointment }) {
  const [confirmState, confirmAction] = useActionState<Result, FormData>(confirmByLink, null);
  const [cancelState, cancelAction] = useActionState<Result, FormData>(cancelByLink, null);
  const [enhanced, setEnhanced] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- progressive enhancement switch after hydration
    setEnhanced(true);
  }, []);

  const cancelled = cancelState?.ok === true;
  const a: ManagedAppointment = cancelled
    ? cancelState.data
    : confirmState?.ok
      ? confirmState.data
      : appointment;
  const latest = cancelState ?? confirmState;
  const message = latest ? (latest.ok ? latest.message : latest.error) : null;

  useEffect(() => {
    if (message) statusRef.current?.focus();
  }, [message]);

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid gap-x-8 gap-y-4 rounded-panou border border-linie bg-suprafata p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <dt className="text-mic text-discret">Ziua</dt>
          <dd className="text-h3 font-semibold text-cerneala">{a.dateLabel}</dd>
        </div>
        <div>
          <dt className="text-mic text-discret">Ora</dt>
          <dd className="text-h3 font-semibold text-cerneala cifre">{a.time}</dd>
        </div>
        <div>
          <dt className="text-mic text-discret">Clinica</dt>
          <dd className="text-corp text-cerneala">
            {a.locationName}
            <span className="block text-discret">{a.address}</span>
          </dd>
        </div>
        <div>
          <dt className="text-mic text-discret">Medicul</dt>
          <dd className="text-corp text-cerneala">{a.doctorName}</dd>
        </div>
      </dl>

      {message && (
        <p
          ref={statusRef}
          tabIndex={-1}
          role={latest?.ok ? "status" : "alert"}
          className={
            latest?.ok
              ? "rounded-panou bg-menta-pal px-5 py-4 text-corp text-cerneala outline-none"
              : "rounded-panou border-l-4 border-carmin bg-carmin-pal px-5 py-4 text-corp text-cerneala outline-none"
          }
        >
          {message}
        </p>
      )}

      {!cancelled && (
        <>
          {a.status === "CONFIRMAT" && !confirmState?.ok && (
            <p className="flex items-center gap-2 text-corp text-cerneala">
              <Icon name="check" size={20} className="text-actiune" />
              Programarea este confirmată.
            </p>
          )}
          {a.status === "PROGRAMAT" && <p className="text-corp text-discret masura">Vă rugăm să confirmați că veniți. Dacă nu mai puteți veni, anulați programarea, ca ora să fie liberă pentru alți pacienți.</p>}

          <div className="flex flex-wrap items-start gap-3">
            {a.canConfirm && (
              <form action={confirmAction}>
                <input type="hidden" name="token" value={token} />
                <SubmitButton icon="check" size="l" pendingLabel="Se confirmă">
                  Confirm programarea
                </SubmitButton>
              </form>
            )}
            <ButtonLink href={`/p/${token}/ics`} variant="secondary" size="l" icon="calendar-plus" prefetch={false}>
              Adăugați în calendar
            </ButtonLink>
            {a.mapsUrl && (
              <ButtonLink href={a.mapsUrl} variant="secondary" size="l" icon="map-pin" target="_blank" rel="noopener noreferrer">
                Deschideți harta
              </ButtonLink>
            )}
          </div>

          {a.canCancel && (
            <form action={cancelAction} className="flex flex-col items-start gap-3">
              <input type="hidden" name="token" value={token} />
              {enhanced && !askCancel ? (
                <Button variant="text" icon="circle-slash" onClick={() => setAskCancel(true)}>
                  Anulez programarea
                </Button>
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-panou border border-linie bg-suprafata p-5">
                  {enhanced && <p className="text-corp text-cerneala">Sigur anulați programarea? Ora devine liberă pentru alți pacienți.</p>}
                  <div className="flex flex-wrap gap-3">
                    <SubmitButton variant="danger" icon="circle-slash" pendingLabel="Se anulează">
                      {enhanced ? "Da, anulez programarea" : "Anulez programarea"}
                    </SubmitButton>
                    {enhanced && (
                      <Button variant="text" onClick={() => setAskCancel(false)}>
                        Nu, păstrez programarea
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </form>
          )}

          {a.cancelClosed && (
            <div className="flex flex-col gap-1">
              <p className="text-corp text-cerneala masura">
                Cu mai puțin de {a.cancelCutoffHours} {a.cancelCutoffHours === 1 ? "oră" : "ore"} înainte, programarea se anulează doar la telefon:
              </p>
              <PhoneLine a={a} />
            </div>
          )}
        </>
      )}

      {(cancelled || (!a.canCancel && !a.cancelClosed)) && (
        <div className="flex flex-col gap-1">
          <p className="text-corp text-discret">Pentru orice modificare sunați la clinică:</p>
          <PhoneLine a={a} />
        </div>
      )}
    </div>
  );
}
