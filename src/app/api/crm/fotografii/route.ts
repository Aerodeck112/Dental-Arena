import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { isDomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { MAX_PHOTO_BYTES, removeDoctorPhoto, resetSiteImage, saveDoctorPhoto, saveSiteImage } from "@/server/media/site-images";

/**
 * POST /api/crm/fotografii: multipart upload of a site photo (`key`, `alt`, `file`) or of a doctor
 * portrait (`doctorId`, `file`); `action=reset` puts back the default photo or removes the
 * portrait. ADMIN only (`settings.manage` for the site, `staff.manage` for portraits), same origin.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
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

export async function POST(request: Request): Promise<Response> {
  const fail = (status: number, message: string, fieldErrors?: Record<string, string[]>) =>
    Response.json({ error: message, ...(fieldErrors ? { fieldErrors } : {}) }, { status, headers: NO_STORE });

  if (!sameOrigin(request)) return fail(403, "Cererea nu vine din aplicație.");
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sesiunea a expirat. Intrați din nou în cont.");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_PHOTO_BYTES + BODY_SLACK) return fail(413, "Fotografia depășește 15 MB. Alegeți una mai mică.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Cererea nu a putut fi citită. Alegeți din nou fotografia.");
  }
  const action = String(form.get("action") ?? "upload");
  const doctorId = form.get("doctorId");
  const key = form.get("key");
  const file = form.get("file");

  try {
    if (typeof doctorId === "string" && doctorId) {
      if (!can(user, "staff.manage")) return fail(403, "Doar administratorul schimbă fotografiile medicilor.");
      if (!zId.safeParse(doctorId).success) return fail(404, "Profilul medicului nu există.");
      if (action === "reset") await removeDoctorPhoto(doctorId, user);
      else if (file instanceof File) await saveDoctorPhoto(doctorId, file, user);
      else return fail(400, "Alegeți o fotografie.", { file: ["Alegeți o fotografie."] });
      revalidatePath("/", "layout");
      return Response.json({ ok: true }, { headers: NO_STORE });
    }
    if (typeof key !== "string" || !key) return fail(400, "Locul fotografiei lipsește.");
    if (!can(user, "settings.manage")) return fail(403, "Doar administratorul schimbă fotografiile site-ului.");
    if (action === "reset") await resetSiteImage(key, user);
    else if (file instanceof File) await saveSiteImage(key, file, String(form.get("alt") ?? ""), user);
    else return fail(400, "Alegeți o fotografie.", { file: ["Alegeți o fotografie."] });
    revalidatePath("/", "layout");
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    if (isDomainError(e)) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400;
      return fail(status, e.message, e.fieldErrors);
    }
    console.error("[fotografii]", e);
    return fail(500, "Fotografia nu a putut fi salvată. Încercați din nou.");
  }
}
