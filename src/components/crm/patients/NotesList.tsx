"use client";

import { useState } from "react";
import { deleteNoteAction, pinNoteAction, updateNoteAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/note/actions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { FlagTag } from "@/components/ui/FlagTag";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { formatDateTime } from "@/lib/format";
import type { NoteDTO } from "@/server/patients/types";
import { runPatientAction, usePatientAction } from "./use-patient-action";

type Viewer = { id: string; isAdmin: boolean; canClinicalEdit: boolean };

/** Notes, pinned first. Only the author or an ADMIN edits; clinical notes are never deleted. */
export function NotesList({ patientId, notes, viewer, readOnly }: { patientId: string; notes: NoteDTO[]; viewer: Viewer; readOnly?: boolean }) {
  if (notes.length === 0) return <EmptyState title="Nicio notă încă. Scrieți aici ce trebuie să știe colegii despre pacient." />;
  return (
    <ul className="flex flex-col divide-y divide-linie">
      {notes.map((n) => (
        <NoteItem key={n.id} patientId={patientId} note={n} viewer={viewer} readOnly={readOnly} />
      ))}
    </ul>
  );
}

function NoteItem({ patientId, note: n, viewer, readOnly }: { patientId: string; note: NoteDTO; viewer: Viewer; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const canModify = !readOnly && (viewer.isAdmin || n.authorId === viewer.id) && (!n.clinical || viewer.canClinicalEdit);
  const canPin = !readOnly && (!n.clinical || viewer.canClinicalEdit);
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(updateNoteAction, { onSuccess: () => setEditing(false) });

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-mic text-discret">
        {n.pinned && <FlagTag kind="neutral">Fixată</FlagTag>}
        {n.clinical && <FlagTag kind="neutral">Clinică</FlagTag>}
        <span>
          {n.author ?? "Autor necunoscut"}, {formatDateTime(new Date(n.createdAt))}
          {n.updatedAt !== n.createdAt && n.updatedAt.slice(0, 16) !== n.createdAt.slice(0, 16) ? ", modificată" : ""}
        </span>
      </div>
      {editing ? (
        <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
          {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
          <input type="hidden" name="id" value={patientId} />
          <input type="hidden" name="noteId" value={n.id} />
          <TextArea label="Textul notei" name="body" id={`note-${n.id}`} rows={3} maxLength={5000} defaultValue={n.body} error={errors?.body} />
          <div className="flex gap-2">
            <SubmitButton size="s" pendingLabel="Se salvează">
              Salvați
            </SubmitButton>
            <Button size="s" variant="text" onClick={() => setEditing(false)}>
              Renunțați
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-line text-corp text-cerneala">{n.body}</p>
      )}
      {!editing && (canPin || canModify) && (
        <div className="flex flex-wrap gap-1">
          {canPin && (
            <Button size="s" variant="text" onClick={() => runPatientAction(pinNoteAction({ id: patientId, noteId: n.id, pinned: !n.pinned }), n.pinned ? "Nota nu mai este fixată." : "Nota a fost fixată.")}>
              {n.pinned ? "Nu mai fixați" : "Fixați"}
            </Button>
          )}
          {canModify && (
            <Button size="s" variant="text" icon="pencil" onClick={() => setEditing(true)}>
              Modificați
            </Button>
          )}
          {canModify && !n.clinical && (
            <Button
              size="s"
              variant="text"
              onClick={() => {
                if (window.confirm("Ștergeți nota? Nu se poate reveni.")) void runPatientAction(deleteNoteAction({ id: patientId, noteId: n.id }));
              }}
            >
              Ștergeți
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
