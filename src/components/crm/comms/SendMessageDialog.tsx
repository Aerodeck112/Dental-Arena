"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Dialog, ErrorSummary, RadioGroup, TextArea, TextField, Toaster, showToast } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { formatPhone } from "@/lib/format";
import type { MessageChannel } from "@/server/notify/types";
import { sendMessage } from "./actions";

/**
 * „Trimiteți un mesaj” (docs/architecture.md §7.3). Used in Mesaje (free recipient) and on the
 * patient file or a lead (the recipient comes from their record; the server checks consent).
 * ADMIN and RECEPTIE only: the caller renders it only with `messages.send`.
 */

type Props = {
  patientId?: string;
  leadId?: string;
  phone?: string | null;
  email?: string | null;
  defaultChannel?: MessageChannel;
  /** Label of the button that opens the dialog. */
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "text";
};

type Result = ActionResult<{ status: string }> | null;

const SMS_MAX = 640;

export function SendMessageDialog({
  patientId,
  leadId,
  phone,
  email,
  defaultChannel,
  triggerLabel = "Trimiteți un mesaj",
  triggerVariant = "secondary",
}: Props) {
  const bound = Boolean(patientId || leadId);
  const canSms = !bound || Boolean(phone);
  const canEmail = !bound || Boolean(email);
  const initial: MessageChannel = defaultChannel && (defaultChannel === "SMS" ? canSms : canEmail) ? defaultChannel : canSms ? "SMS" : "EMAIL";

  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<MessageChannel>(initial);
  const [body, setBody] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [state, setState] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  // Submitted by hand rather than through `<form action>`: React resets a form after every action,
  // which would wipe the typed recipient and subject and desync the channel radio on a validation error.
  const close = () => {
    setOpen(false);
    setState(null);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await sendMessage(fd);
      if (r.ok) {
        showToast({ kind: r.data.status === "EROARE" ? "error" : "success", message: r.message ?? "Mesaj trimis." });
        setOpen(false);
        setBody("");
        setFormKey((k) => k + 1);
        setState(null);
        return;
      }
      setState(r);
    });
  };

  const recipient = channel === "SMS" ? (phone ? formatPhone(phone) : null) : (email ?? null);
  const errors = state && !state.ok ? state.fieldErrors : null;
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;
  const tooLong = channel === "SMS" && body.length > SMS_MAX;

  return (
    <>
      <Button type="button" variant={triggerVariant} icon="message-square" onClick={() => setOpen(true)} disabled={!canSms && !canEmail}>
        {triggerLabel}
      </Button>
      <Toaster />
      <Dialog
        open={open}
        onClose={close}
        title="Trimiteți un mesaj"
        description={
          bound
            ? recipient
              ? `Către ${recipient}. Mesajul se păstrează în jurnalul de mesaje.`
              : "Alegeți canalul pentru care există date de contact."
            : "Scrieți destinatarul și textul. Mesajul se păstrează în jurnalul de mesaje."
        }
        size="m"
      >
        <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {(errors || formError) && <ErrorSummary errors={errors} message={formError} />}
          {patientId && <input type="hidden" name="patientId" value={patientId} />}
          {leadId && <input type="hidden" name="leadId" value={leadId} />}
          <RadioGroup
            legend="Canal"
            name="channel"
            inline
            value={channel}
            onChange={(v) => setChannel(v as MessageChannel)}
            error={errors?.channel}
            options={[
              { value: "SMS", label: "SMS", disabled: !canSms, description: bound && !phone ? "Fără număr de telefon" : undefined },
              { value: "EMAIL", label: "E-mail", disabled: !canEmail, description: bound && !email ? "Fără adresă de e-mail" : undefined },
            ]}
          />
          {!bound && (
            <TextField
              key={channel}
              label={channel === "SMS" ? "Număr de telefon" : "Adresa de e-mail"}
              name="to"
              type={channel === "SMS" ? "tel" : "email"}
              autoComplete="off"
              inputMode={channel === "SMS" ? "tel" : "email"}
              hint={channel === "SMS" ? "De exemplu 0745 123 456" : undefined}
              error={errors?.to}
              required
            />
          )}
          {channel === "EMAIL" && <TextField label="Subiect" name="subject" maxLength={150} error={errors?.subject} required />}
          <TextArea
            label="Mesaj"
            name="body"
            rows={channel === "SMS" ? 4 : 7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={channel === "SMS" ? SMS_MAX + 200 : 2000}
            error={errors?.body ?? (tooLong ? `Un SMS are cel mult ${SMS_MAX} de caractere. Scurtați textul.` : undefined)}
            hint={
              <span className="cifre" aria-live="polite">
                {body.length} {body.length === 1 ? "caracter" : "caractere"}
                {channel === "SMS" ? `, cel mult ${SMS_MAX}. Nu scrieți detalii medicale în SMS.` : ". Nu scrieți detalii medicale în e-mail."}
              </span>
            }
            required
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="text" onClick={close}>
              Renunțați
            </Button>
            <Button type="submit" icon="message-square" loading={pending} disabled={tooLong || (!canSms && !canEmail)}>
              {pending ? "Se trimite" : "Trimiteți mesajul"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
