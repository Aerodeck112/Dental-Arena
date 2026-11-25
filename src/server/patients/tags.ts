import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { assertPatientEditable } from "./service";
import type { TagDTO } from "./types";

/** Patient tags („Familie”, „Implant în curs”). Anyone with `patients.edit` may create a new one. */

export const TAG_COLORS = ["menta", "discret"] as const;

export async function listTags(): Promise<(TagDTO & { count: number })[]> {
  const rows = await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { patients: true } } } });
  return rows
    .map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.patients }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export async function setPatientTags(
  actor: CurrentUser,
  patientId: string,
  i: { tagIds: string[]; newTag?: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertPatientEditable(tx, patientId);
    const ids = new Set(i.tagIds);
    const name = i.newTag?.replace(/\s+/g, " ").trim();
    if (name) {
      const existing = (await tx.tag.findMany({ select: { id: true, name: true } })).find(
        (t) => t.name.localeCompare(name, "ro", { sensitivity: "base" }) === 0,
      );
      const tag = existing ?? (await tx.tag.create({ data: { name, color: "discret" }, select: { id: true, name: true } }));
      ids.add(tag.id);
    }
    const valid = await tx.tag.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
    if (valid.length !== ids.size) throw new DomainError("VALIDATION", "Una dintre etichete nu mai există. Reîncărcați pagina.");
    await tx.patientTag.deleteMany({ where: { patientId, tagId: { notIn: [...ids] } } });
    for (const tagId of ids) {
      await tx.patientTag.upsert({
        where: { patientId_tagId: { patientId, tagId } },
        create: { patientId, tagId },
        update: {},
      });
    }
    await audit(
      { action: "patient.update", entityType: "Patient", entityId: patientId, patientId, metadata: { fields: ["tags"] } },
      { actor, db: tx },
    );
  });
}
