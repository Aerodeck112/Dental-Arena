"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { TextArea } from "@/components/ui/TextArea";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";

type CancelAction = (prev: unknown, fd: FormData) => Promise<ActionResult<unknown>>;

/**
 * „Anulați …” with a mandatory reason (ADMIN only; the server checks again). Used for invoices and
 * payments: the record stays, marked cancelled, and the reason is kept in the audit trail.
 */
export function CancelDialog({
  id,
  action,
  triggerLabel,
  title,
  description,
  confirmLabel,
  triggerVariant = "secondary",
  triggerSize = "m",
}: {
  id: string;
  action: CancelAction;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult<unknown> | null, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) {
      setOpen(false);
      showToast({ kind: "success", message: r.message ?? "Anulare înregistrată." });
    }
    return r;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const formId = `anulare-${id}`;

  return (
    <>
      <Button type="button" variant={triggerVariant} size={triggerSize} icon="circle-slash" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="s"
        footer={
          <>
            <Button type="button" variant="text" onClick={() => setOpen(false)}>
              Renunțați
            </Button>
            <Button type="submit" form={formId} variant="danger" loading={pending}>
              {pending ? "Se anulează" : confirmLabel}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          action={formAction}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          noValidate
          className="flex flex-col gap-3"
        >
          {state && !state.ok && <ErrorSummary errors={errors} message={errors ? null : state.error} idFor={(n) => `${formId}-${n}`} />}
          <input type="hidden" name="id" value={id} />
          <TextArea
            id={`${formId}-reason`}
            label="Motivul anulării"
            name="reason"
            required
            rows={3}
            maxLength={300}
            hint="Rămâne în jurnalul de audit."
            error={errors?.reason}
          />
        </form>
      </Dialog>
    </>
  );
}
