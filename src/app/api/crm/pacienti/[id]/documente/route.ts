import { getCurrentUser } from "@/lib/auth/dal";
import { isDomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { MAX_UPLOAD_BYTES, uploadDocument } from "@/server/patients/documents";
import { documentMetaSchema } from "@/server/patients/schemas";

/**
 * POST /api/crm/pacienti/[id]/documente (docs/architecture.md §4.3, §8.1, §8.3): multipart upload
 * of one patient document, at most 20 MB. Session plus `documents.upload` plus a same-origin check
 * (route handlers do not get the Server Action Origin check). The type is checked by extension,
 * declared MIME and magic bytes; the SHA-256 is stored; the file goes to `STORAGE_DIR`.
 *
 * Answers JSON for `fetch` (the upload component); a plain HTML form post (no JS) is redirected
 * back to the documents tab.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** Multipart overhead allowed above the file limit. */
const BODY_SLACK = 64 * 1024;

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/crm/pacienti/[id]/documente">): Promise<Response> {
  const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");
  const { id } = await ctx.params;
  const back = (q: string) => Response.redirect(new URL(`/crm/pacienti/${id}/documente?${q}`, request.url), 303);
  const fail = (status: number, message: string, fieldErrors?: Record<string, string[]>) =>
    wantsHtml && status !== 401 && status !== 403
      ? back(`eroare=${encodeURIComponent(message)}`)
      : Response.json({ error: message, ...(fieldErrors ? { fieldErrors } : {}) }, { status, headers: NO_STORE });

  if (!sameOrigin(request)) return fail(403, "Cererea nu vine din aplicație.");
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sesiunea a expirat. Intrați din nou în cont.");
  if (!can(user, "documents.upload")) return fail(403, "Nu aveți dreptul să încărcați documente.");
  if (!zId.safeParse(id).success) return fail(404, "Pacientul nu a fost găsit.");

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_UPLOAD_BYTES + BODY_SLACK) return fail(413, "Fișierul depășește 20 MB. Micșorați-l sau alegeți alt fișier.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Cererea nu a putut fi citită. Alegeți din nou fișierul.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "Alegeți un fișier.", { file: ["Alegeți un fișier."] });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(413, "Fișierul depășește 20 MB. Micșorați-l sau alegeți alt fișier.", { file: ["Fișierul depășește 20 MB."] });
  }
  const meta = documentMetaSchema.safeParse({
    kind: form.get("kind") ?? undefined,
    title: form.get("title") || undefined,
    tooth: form.get("tooth") || undefined,
    takenAt: form.get("takenAt") || undefined,
  });
  if (!meta.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of meta.error.issues) {
      const k = String(issue.path[0] ?? "form");
      (fieldErrors[k] ??= []).push(issue.message);
    }
    return fail(400, "Verificați câmpurile marcate.", fieldErrors);
  }

  try {
    const document = await uploadDocument(user, {
      patientId: id,
      kind: meta.data.kind,
      title: meta.data.title ?? null,
      tooth: meta.data.tooth ?? null,
      takenAt: meta.data.takenAt ?? null,
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (wantsHtml) return back("incarcat=1");
    return Response.json({ document }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (isDomainError(e)) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "CONFLICT" ? 409 : 400;
      return fail(status, e.message, e.fieldErrors);
    }
    console.error(`[api/crm/documente] upload failed: ${e instanceof Error ? e.name : typeof e}`);
    return fail(500, "Documentul nu a putut fi salvat. Încercați din nou.");
  }
}
