"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { softDeleteDocument } from "@/server/patients/documents";
import { documentDeleteSchema } from "@/server/patients/schemas";

/** Documents: upload goes through the route handler (files up to 20 MB); soft delete is ADMIN only. */
export const deleteDocumentAction = crmAction(
  { permission: "documents.delete", schema: documentDeleteSchema, successMessage: "Documentul a fost șters." },
  async ({ id, documentId }, { user }) => {
    await softDeleteDocument(user, id, documentId);
    revalidatePath(`/crm/pacienti/${id}/documente`);
    revalidatePath(`/crm/pacienti/${id}/consimtaminte`);
    return null;
  },
);
