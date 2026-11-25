"use client";

import { useState } from "react";
import { revokeConsentAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/consimtaminte/actions";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { CONSENT_METHOD_LABEL, CONSENT_TYPE_LABEL } from "@/lib/labels";
import type { ConsentDTO } from "@/server/patients/types";
import { runPatientAction } from "./use-patient-action";

/** Consent history with timestamp, method and text version; a decision in force can be revoked. */
export function ConsentList({ patientId, rows, canManage }: { patientId: string; rows: ConsentDTO[]; canManage: boolean }) {
  const [revoking, setRevoking] = useState<ConsentDTO | null>(null);
  const [pending, setPending] = useState(false);
  const columns: DataTableColumn<ConsentDTO>[] = [
    {
      key: "type",
      header: "Consimțământ",
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold text-cerneala">{CONSENT_TYPE_LABEL[r.type]}</span>
          {r.planTitle && <span className="text-mic text-discret">{r.planTitle}</span>}
        </span>
      ),
    },
    {
      key: "decision",
      header: "Decizie",
      render: (r) =>
        r.revokedAt ? (
          <span className="text-discret">
            {r.granted ? "Acord" : "Refuz"}, înlocuit sau retras {formatDateTime(new Date(r.revokedAt))}
          </span>
        ) : r.granted ? (
          <span className="font-semibold text-cerneala">Acord în vigoare</span>
        ) : (
          <span className="font-semibold text-carmin">Refuz</span>
        ),
    },
    { key: "at", header: "Înregistrat", className: "cifre whitespace-nowrap", render: (r) => formatDateTime(new Date(r.grantedAt)) },
    { key: "method", header: "Metoda", render: (r) => CONSENT_METHOD_LABEL[r.method] },
    { key: "version", header: "Versiunea textului", className: "cifre", render: (r) => r.textVersion },
    {
      key: "doc",
      header: "Document",
      render: (r) =>
        r.document ? (
          <a href={`/api/crm/documente/${r.document.id}`} className="text-link underline underline-offset-4">
            {r.document.title}
          </a>
        ) : (
          "–"
        ),
    },
    { key: "by", header: "De", render: (r) => r.recordedBy ?? "–" },
    {
      key: "actions",
      header: <span className="sr-only">Acțiuni</span>,
      render: (r) =>
        canManage && !r.revokedAt && r.granted ? (
          <Button size="s" variant="text" onClick={() => setRevoking(r)}>
            Retrageți
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      <DataTable
        caption="Consimțămintele pacientului, cele mai noi primele"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title="Niciun consimțământ înregistrat. Înregistrați acordul GDPR la prima vizită." />}
      />
      <Dialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Retrageți consimțământul?"
        description={revoking ? `${CONSENT_TYPE_LABEL[revoking.type]}: pacientul își retrage acordul de azi înainte. Istoricul rămâne în fișă.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)}>
              Renunțați
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                if (!revoking) return;
                setPending(true);
                const r = await runPatientAction(revokeConsentAction({ id: patientId, consentId: revoking.id }));
                setPending(false);
                if (r.ok) setRevoking(null);
              }}
            >
              Retrageți consimțământul
            </Button>
          </>
        }
      />
    </>
  );
}
