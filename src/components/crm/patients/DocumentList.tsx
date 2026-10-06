"use client";

import { useState } from "react";
import { deleteDocumentAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/documente/actions";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateRo } from "@/lib/format";
import { DOCUMENT_KIND_LABEL } from "@/lib/labels";
import type { DocumentDTO } from "@/server/patients/types";
import { runPatientAction } from "./use-patient-action";

export type DocumentRow = DocumentDTO & { size: string };

/** Document metadata. Download goes through the authenticated route (audited); delete is ADMIN only. */
export function DocumentList({ patientId, rows, canDelete }: { patientId: string; rows: DocumentRow[]; canDelete: boolean }) {
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const [pending, setPending] = useState(false);
  const columns: DataTableColumn<DocumentRow>[] = [
    {
      key: "title",
      header: "Document",
      render: (r) =>
        r.deletedAt ? (
          <span className="text-discret line-through">{r.title}</span>
        ) : (
          <a href={`/api/crm/documente/${r.id}`} className="font-semibold text-link underline underline-offset-4" download>
            {r.title}
          </a>
        ),
    },
    { key: "kind", header: "Tip", render: (r) => DOCUMENT_KIND_LABEL[r.kind] },
    { key: "tooth", header: "Dinte", className: "cifre", render: (r) => r.tooth ?? "–" },
    { key: "taken", header: "Data imaginii", className: "cifre whitespace-nowrap", render: (r) => (r.takenAt ? formatDateRo(r.takenAt, "short") : "–") },
    { key: "size", header: "Mărime", align: "right", className: "cifre whitespace-nowrap", render: (r) => r.size },
    {
      key: "uploaded",
      header: "Încărcat",
      render: (r) => (
        <span className="whitespace-nowrap">
          {formatDateRo(r.createdAt, "short")}
          {r.uploadedBy ? `, ${r.uploadedBy}` : ""}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acțiuni</span>,
      render: (r) =>
        r.deletedAt ? (
          <span className="text-mic text-discret">Șters</span>
        ) : canDelete ? (
          <Button size="s" variant="text" onClick={() => setDeleting(r)}>
            Ștergeți
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      <DataTable
        caption="Documentele pacientului, cele mai noi primele"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title="Niciun document încă. Încărcați radiografii, fotografii sau formulare semnate." />}
      />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Ștergeți documentul?"
        description={deleting ? `„${deleting.title}” dispare din fișă. Înregistrarea rămâne în jurnal.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Renunțați
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                if (!deleting) return;
                setPending(true);
                const r = await runPatientAction(deleteDocumentAction({ id: patientId, documentId: deleting.id }));
                setPending(false);
                if (r.ok) setDeleting(null);
              }}
            >
              Ștergeți documentul
            </Button>
          </>
        }
      />
    </>
  );
}
