"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field } from "@/components/ui/Field";
import { inputClasses } from "@/components/ui/field-styles";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { DOCUMENT_KIND_LABEL } from "@/lib/labels";
import { DOCUMENT_KIND_VALUES } from "@/server/patients/schemas";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.dcm,image/jpeg,image/png,image/webp,application/pdf,application/dicom";

/**
 * Upload through `POST /api/crm/pacienti/[id]/documente` (files up to 20 MB do not fit a Server
 * Action). Without JS the form posts natively and the route redirects back here.
 */
export function DocumentUpload({ patientId, serverError }: { patientId: string; serverError?: string | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [message, setMessage] = useState<string | null>(serverError ?? null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setErrors({ file: ["Alegeți un fișier."] });
      setMessage(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrors({ file: ["Fișierul depășește 20 MB. Micșorați-l sau alegeți alt fișier."] });
      setMessage(null);
      return;
    }
    setPending(true);
    setErrors(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/crm/pacienti/${patientId}/documente`, { method: "POST", body: fd, headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]> };
      if (!res.ok) {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        else setMessage(body.error ?? "Documentul nu a putut fi încărcat. Încercați din nou.");
        return;
      }
      showToast({ kind: "success", message: "Documentul a fost încărcat." });
      form.reset();
      router.refresh();
    } catch {
      setMessage("Conexiunea s-a întrerupt. Verificați internetul și încercați din nou.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={`/api/crm/pacienti/${patientId}/documente`}
      method="post"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {(errors || message) && <ErrorSummary errors={errors} message={message} />}
      <Field label="Fișierul" name="file" hint="JPEG, PNG, WebP, PDF sau DICOM, cel mult 20 MB." error={errors?.file} required>
        <input type="file" name="file" accept={ACCEPT} className={inputClasses("py-2 file:mr-3 file:rounded-control file:border-0 file:bg-adancit file:px-3 file:py-1 file:text-cerneala")} />
      </Field>
      <Select
        label="Tipul documentului"
        name="kind"
        defaultValue="RADIOGRAFIE_PANORAMICA"
        options={DOCUMENT_KIND_VALUES.map((k) => ({ value: k, label: DOCUMENT_KIND_LABEL[k] }))}
        error={errors?.kind}
      />
      <TextField label="Titlu" name="title" optional maxLength={160} hint="Implicit, numele fișierului." error={errors?.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Dintele" name="tooth" optional inputMode="numeric" maxLength={2} hint="FDI, de exemplu 36." error={errors?.tooth} inputClassName="cifre" />
        <DateInput label="Data imaginii" name="takenAt" optional error={errors?.takenAt} />
      </div>
      <div>
        <Button type="submit" icon="upload" loading={pending}>
          {pending ? "Se încarcă" : "Încărcați documentul"}
        </Button>
      </div>
    </form>
  );
}
