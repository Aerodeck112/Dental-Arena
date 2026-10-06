"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { SearchField } from "@/components/ui/SearchField";
import { Select } from "@/components/ui/Select";

/**
 * Patient search: a GET form, so results are linkable and work without JS. Name with or without
 * diacritics, phone in any format, e-mail or file number („nr. 123”). Changing the tag submits.
 */
export function PatientSearchBox({ q, tagId, tags }: { q: string; tagId: string; tags: { id: string; name: string; count: number }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action="/crm/pacienti" method="get" role="search" className="flex flex-wrap items-end gap-3">
      <SearchField
        label="Căutați un pacient"
        name="q"
        defaultValue={q}
        placeholder="Nume, telefon, e-mail sau nr. fișă"
        autoComplete="off"
        className="min-w-0 flex-1 basis-72"
      />
      <Select
        label="Etichetă"
        name="eticheta"
        defaultValue={tagId}
        placeholder="Toate etichetele"
        options={tags.map((t) => ({ value: t.id, label: `${t.name} (${t.count})` }))}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full sm:w-56"
      />
      <Button type="submit" icon="search">
        Căutați
      </Button>
    </form>
  );
}
