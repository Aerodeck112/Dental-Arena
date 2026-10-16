"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crmAction, DomainError } from "@/lib/actions";
import { findDuplicateMatches } from "@/server/patients/duplicates";
import { duplicateQuerySchema, patientCreateSchema } from "@/server/patients/schemas";
import { createPatient, searchPatientSummaries } from "@/server/patients/service";
import { prisma } from "@/lib/db";

/** „Pacient nou” and the patient pickers (docs/architecture.md §4.2 `/crm/pacienti`, WP7). */

export const checkDuplicatesAction = crmAction(
  { permission: "patients.view", schema: duplicateQuerySchema },
  async (q) => findDuplicateMatches(q),
);

export const searchPatientsAction = crmAction(
  { permission: "patients.view", schema: z.object({ q: z.string().max(80), excludeId: z.string().max(40).optional() }) },
  async ({ q, excludeId }) => searchPatientSummaries(q, 8, excludeId),
);

export const createPatientAction = crmAction(
  { permission: "patients.create", schema: patientCreateSchema },
  async ({ confirmDuplicate, ...i }, { user }) => {
    if (!confirmDuplicate) {
      const duplicates = await findDuplicateMatches(i);
      if (duplicates.length > 0) {
        throw new DomainError(
          "CONFLICT",
          duplicates.length === 1 ? "Există deja o fișă care pare a fi a aceluiași pacient." : "Există deja fișe care par a fi ale aceluiași pacient.",
          { details: { duplicates } },
        );
      }
    }
    const p = await createPatient(prisma, i, user);
    revalidatePath("/crm/pacienti");
    redirect(`/crm/pacienti/${p.id}`);
  },
);
