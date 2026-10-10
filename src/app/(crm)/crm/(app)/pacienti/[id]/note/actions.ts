"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { addNote, deleteNote, setNotePinned, updateNote } from "@/server/patients/notes";
import { noteDeleteSchema, notePinSchema, noteSchema, noteUpdateSchema } from "@/server/patients/schemas";

/** Notes: administrative for everyone, clinical only for ADMIN and MEDIC (enforced by the service). */

function refresh(id: string) {
  revalidatePath(`/crm/pacienti/${id}`, "layout");
}

export const addNoteAction = crmAction(
  { permission: "patients.view", schema: noteSchema, successMessage: "Nota a fost adăugată." },
  async ({ id, ...i }, { user }) => {
    const r = await addNote(user, id, i);
    refresh(id);
    return r;
  },
);

export const updateNoteAction = crmAction(
  { permission: "patients.view", schema: noteUpdateSchema, successMessage: "Nota a fost salvată." },
  async ({ id, noteId, body }, { user }) => {
    await updateNote(user, id, noteId, body);
    refresh(id);
    return null;
  },
);

export const pinNoteAction = crmAction({ permission: "patients.view", schema: notePinSchema }, async ({ id, noteId, pinned }, { user }) => {
  await setNotePinned(user, id, noteId, pinned);
  refresh(id);
  return { pinned };
});

export const deleteNoteAction = crmAction(
  { permission: "patients.view", schema: noteDeleteSchema, successMessage: "Nota a fost ștearsă." },
  async ({ id, noteId }, { user }) => {
    await deleteNote(user, id, noteId);
    refresh(id);
    return null;
  },
);
