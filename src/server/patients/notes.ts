import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { assertPatientEditable } from "./service";
import type { NoteDTO } from "./types";

/**
 * Patient notes: administrative (everyone) and clinical (ADMIN and MEDIC only, §5.2). RECEPTIE
 * never receives clinical notes from this service, whatever the UI asks for.
 */

export async function listNotes(user: CurrentUser, patientId: string, o: { pinnedOnly?: boolean } = {}): Promise<NoteDTO[]> {
  const clinicalAllowed = can(user, "medical.view");
  const rows = await prisma.patientNote.findMany({
    where: { patientId, ...(clinicalAllowed ? {} : { clinical: false }), ...(o.pinnedOnly ? { pinned: true } : {}) },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 300,
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((n) => ({
    id: n.id,
    body: n.body,
    clinical: n.clinical,
    pinned: n.pinned,
    author: n.author ? personName(n.author) : null,
    authorId: n.authorId,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    appointmentId: n.appointmentId,
  }));
}

async function loadNote(user: CurrentUser, patientId: string, noteId: string) {
  const n = await prisma.patientNote.findFirst({ where: { id: noteId, patientId } });
  if (!n || (n.clinical && !can(user, "medical.view"))) throw new DomainError("NOT_FOUND", "Nota nu a fost găsită.");
  return n;
}

/** Only the author or an ADMIN may change or delete a note. */
function assertCanModify(user: CurrentUser, n: { authorId: string | null; clinical: boolean }) {
  if (n.clinical && !can(user, "medical.edit")) throw new DomainError("FORBIDDEN", "Nu aveți dreptul să modificați note clinice.");
  if (user.role !== "ADMIN" && n.authorId !== user.id) {
    throw new DomainError("FORBIDDEN", "Doar autorul notei sau un administrator o poate modifica.");
  }
}

export async function addNote(
  user: CurrentUser,
  patientId: string,
  i: { body: string; clinical: boolean; pinned: boolean; appointmentId?: string | null },
): Promise<{ id: string }> {
  if (i.clinical && !can(user, "medical.edit")) {
    throw new DomainError("FORBIDDEN", "Notele clinice pot fi scrise doar de medici și administratori.");
  }
  await assertPatientEditable(prisma, patientId);
  const n = await prisma.patientNote.create({
    data: { patientId, body: i.body, clinical: i.clinical, pinned: i.pinned, authorId: user.id, appointmentId: i.appointmentId ?? null },
    select: { id: true },
  });
  if (i.clinical) {
    await audit(
      { action: "medical.update", entityType: "PatientNote", entityId: n.id, patientId, metadata: { fields: ["clinicalNote"] } },
      { actor: user },
    );
  }
  return n;
}

export async function updateNote(user: CurrentUser, patientId: string, noteId: string, body: string): Promise<void> {
  const n = await loadNote(user, patientId, noteId);
  assertCanModify(user, n);
  await prisma.patientNote.update({ where: { id: n.id }, data: { body } });
  if (n.clinical) {
    await audit(
      { action: "medical.update", entityType: "PatientNote", entityId: n.id, patientId, metadata: { fields: ["clinicalNote"] } },
      { actor: user },
    );
  }
}

/** Pinning is open to anyone who can see the note: it is a shared reading aid. */
export async function setNotePinned(user: CurrentUser, patientId: string, noteId: string, pinned: boolean): Promise<void> {
  const n = await loadNote(user, patientId, noteId);
  if (n.clinical && !can(user, "medical.edit")) throw new DomainError("FORBIDDEN", "Nu aveți dreptul să modificați note clinice.");
  await prisma.patientNote.update({ where: { id: n.id }, data: { pinned } });
}

export async function deleteNote(user: CurrentUser, patientId: string, noteId: string): Promise<void> {
  const n = await loadNote(user, patientId, noteId);
  assertCanModify(user, n);
  if (n.clinical) {
    throw new DomainError("CONFLICT", "Notele clinice nu se șterg. Adăugați o notă nouă care o corectează.");
  }
  await prisma.patientNote.delete({ where: { id: n.id } });
}
