"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { deleteCategoryAction, saveCategoryAction } from "@/app/(crm)/crm/(app)/servicii/actions";
import { useActionForm } from "./use-action-form";

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  sortOrder: number;
  publicVisible: boolean;
  active: boolean;
  serviceCount: number;
};

/**
 * A service category (one public service page): name, address (slug), the one-sentence summary
 * for the home index, order and visibility. Deleting is possible only while it has no services.
 */
export function CategoryEditor({ category, nextSortOrder = 0 }: { category?: CategoryDTO; nextSortOrder?: number }) {
  const [open, setOpen] = useState(false);
  const formId = `categorie-${category?.id ?? "noua"}`;
  const ids = (n: string) => `${formId}-${n}`;
  const save = useActionForm(saveCategoryAction, { onSuccess: () => setOpen(false) });
  const del = useActionForm(deleteCategoryAction, { onSuccess: () => setOpen(false) });

  return (
    <>
      <Button type="button" variant={category ? "text" : "secondary"} size={category ? "s" : "m"} icon={category ? "pencil" : "plus"} onClick={() => setOpen(true)}>
        {category ? "Editați categoria" : "Categorie nouă"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={category ? `Categoria ${category.name}` : "Categorie nouă"}
        description="Fiecare categorie are o pagină pe site, la adresa /servicii/<adresă>."
        footer={
          <>
            {category && category.serviceCount === 0 && (
              <form action={del.formAction} onSubmit={del.onSubmit} className="mr-auto">
                <input type="hidden" name="id" value={category.id} />
                <Button type="submit" variant="text" icon="x" loading={del.pending}>
                  Ștergeți categoria
                </Button>
              </form>
            )}
            <Button type="button" variant="text" onClick={() => setOpen(false)}>
              Renunțați
            </Button>
            <Button type="submit" form={formId} loading={save.pending}>
              Salvați categoria
            </Button>
          </>
        }
      >
        <form id={formId} action={save.formAction} onSubmit={save.onSubmit} noValidate className="flex flex-col gap-4">
          {(save.errors || save.formError || del.formError) && (
            <ErrorSummary errors={save.errors} message={save.formError ?? del.formError} idFor={ids} />
          )}
          {category && <input type="hidden" name="id" value={category.id} />}
          <TextField id={ids("name")} label="Nume" name="name" required defaultValue={category?.name} maxLength={80} error={save.errors?.name} />
          <TextField
            id={ids("slug")}
            label="Adresa paginii"
            name="slug"
            required
            defaultValue={category?.slug}
            hint="Litere mici fără diacritice și cratimă, de exemplu implantologie. Schimbarea ei mută pagina de pe site."
            error={save.errors?.slug}
          />
          <TextArea id={ids("summary")} label="Rezumat pentru pagina de acasă" name="summary" optional rows={2} maxLength={300} defaultValue={category?.summary ?? ""} error={save.errors?.summary} />
          <TextField
            id={ids("sortOrder")}
            label="Ordinea"
            name="sortOrder"
            inputMode="numeric"
            defaultValue={String(category?.sortOrder ?? nextSortOrder)}
            className="max-w-32"
            error={save.errors?.sortOrder}
          />
          <div className="flex flex-col gap-2">
            <Checkbox name="publicVisible" label="Apare pe site" defaultChecked={category?.publicVisible ?? true} />
            <Checkbox name="active" label="Activă" description="O categorie inactivă nu mai poate fi aleasă la programări și facturi." defaultChecked={category?.active ?? true} />
          </div>
        </form>
      </Dialog>
    </>
  );
}
