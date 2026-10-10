import "server-only";
import { createHash } from "node:crypto";
import type { DocumentKind } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { localToUtc } from "@/lib/time";
import { assertPatientEditable } from "./service";
import { localDateOrNull } from "./summary";
import { newStorageKey, storage as defaultStorage, type FileStorage, type StorageExt } from "./storage";
import type { DocumentDTO } from "./types";

/**
 * Patient documents (docs/architecture.md §4.3, §8.3 „Uploads”, §9.5). Metadata lives in
 * `PatientDocument`; the bytes live in `storage`. An upload is accepted only when the extension,
 * the declared MIME type and the magic bytes agree on one allowed type.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

type FileType = { ext: StorageExt; mime: string; exts: string[]; mimes: string[] };

export const ALLOWED_TYPES: FileType[] = [
  { ext: "jpg", mime: "image/jpeg", exts: ["jpg", "jpeg"], mimes: ["image/jpeg", "image/pjpeg"] },
  { ext: "png", mime: "image/png", exts: ["png"], mimes: ["image/png"] },
  { ext: "webp", mime: "image/webp", exts: ["webp"], mimes: ["image/webp"] },
  { ext: "pdf", mime: "application/pdf", exts: ["pdf"], mimes: ["application/pdf"] },
  // Browsers rarely know DICOM: an empty or generic type is accepted when the bytes say DICM.
  { ext: "dcm", mime: "application/dicom", exts: ["dcm", "dicom"], mimes: ["application/dicom", "application/octet-stream", ""] },
];

export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.pdf,.dcm,image/jpeg,image/png,image/webp,application/pdf,application/dicom";

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Pure: the file type the magic bytes prove, or null. */
export function sniffFileType(bytes: Uint8Array): StorageExt | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (startsWith(bytes, ascii("%PDF-"))) return "pdf";
  if (startsWith(bytes, ascii("DICM"), 128)) return "dcm";
  return null;
}

/** Pure: validates name, declared type, size and bytes together. Throws a Romanian VALIDATION error. */
export function checkUpload(f: { fileName: string; mimeType: string; bytes: Uint8Array }): FileType {
  const invalid = (msg: string) => new DomainError("VALIDATION", msg, { fieldErrors: { file: [msg] } });
  if (f.bytes.length === 0) throw invalid("Fișierul este gol. Alegeți alt fișier.");
  if (f.bytes.length > MAX_UPLOAD_BYTES) throw invalid("Fișierul depășește 20 MB. Micșorați-l sau alegeți alt fișier.");
  const ext = (/\.([a-z0-9]+)$/i.exec(f.fileName)?.[1] ?? "").toLowerCase();
  const declared = (f.mimeType ?? "").toLowerCase().split(";")[0].trim();
  const type = ALLOWED_TYPES.find((t) => t.exts.includes(ext));
  const notAllowed = "Se pot încărca doar imagini JPEG, PNG sau WebP, documente PDF și fișiere DICOM.";
  if (!type || !type.mimes.includes(declared)) throw invalid(notAllowed);
  if (sniffFileType(f.bytes) !== type.ext) {
    throw invalid("Conținutul fișierului nu corespunde tipului său. Alegeți fișierul original.");
  }
  return type;
}

/** Keeps a readable original name without path parts or control characters. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(-160);
  return clean || "document";
}

export type UploadInput = {
  patientId: string;
  kind: DocumentKind;
  title?: string | null;
  tooth?: number | null;
  takenAt?: string | null;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export async function uploadDocument(actor: CurrentUser, i: UploadInput, store: FileStorage = defaultStorage): Promise<DocumentDTO> {
  if (!can(actor, "documents.upload")) throw new DomainError("FORBIDDEN");
  await assertPatientEditable(prisma, i.patientId);
  const type = checkUpload(i);
  const key = newStorageKey(i.patientId, type.ext);
  const sha256 = createHash("sha256").update(i.bytes).digest("hex");
  const fileName = safeFileName(i.fileName);
  await store.put(key, i.bytes, type.mime);
  try {
    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.patientDocument.create({
        data: {
          patientId: i.patientId,
          kind: i.kind,
          title: i.title?.trim() || fileName.replace(/\.[a-z0-9]+$/i, ""),
          fileName,
          mimeType: type.mime,
          sizeBytes: i.bytes.length,
          storageKey: key,
          sha256,
          tooth: i.tooth ?? null,
          takenAt: i.takenAt ? localToUtc(i.takenAt, 0) : null,
          uploadedById: actor.id,
        },
        include: { patient: { select: { id: true } } },
      });
      await audit(
        {
          action: "document.upload",
          entityType: "PatientDocument",
          entityId: d.id,
          patientId: i.patientId,
          metadata: { kind: i.kind, mimeType: type.mime, sizeBytes: i.bytes.length },
        },
        { actor, db: tx },
      );
      return d;
    });
    return toDTO({ ...doc, uploadedBy: { firstName: actor.firstName, lastName: actor.lastName } });
  } catch (e) {
    await store.remove(key).catch(() => undefined);
    throw e;
  }
}

type DocRow = {
  id: string;
  kind: DocumentKind;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  tooth: number | null;
  takenAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  uploadedBy?: { firstName: string; lastName: string } | null;
};

function toDTO(d: DocRow): DocumentDTO {
  return {
    id: d.id,
    kind: d.kind,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    tooth: d.tooth,
    takenAt: localDateOrNull(d.takenAt),
    uploadedBy: d.uploadedBy ? personName(d.uploadedBy) : null,
    createdAt: d.createdAt.toISOString(),
    deletedAt: d.deletedAt?.toISOString() ?? null,
  };
}

/** Active documents, newest first. ADMIN may ask for the soft-deleted ones too. */
export async function listDocuments(user: CurrentUser, patientId: string, o: { includeDeleted?: boolean } = {}): Promise<DocumentDTO[]> {
  const withDeleted = o.includeDeleted && can(user, "documents.delete");
  const rows = await prisma.patientDocument.findMany({
    where: { patientId, ...(withDeleted ? {} : { deletedAt: null }) },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      kind: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      tooth: true,
      takenAt: true,
      createdAt: true,
      deletedAt: true,
      uploadedById: true,
    },
  });
  const ids = [...new Set(rows.map((r) => r.uploadedById).filter((v): v is string => Boolean(v)))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => toDTO({ ...r, uploadedBy: r.uploadedById ? (byId.get(r.uploadedById) ?? null) : null }));
}

/** Opens a document for the download route. Audited as `document.download`. */
export async function openDocumentForDownload(
  actor: CurrentUser,
  documentId: string,
  store: FileStorage = defaultStorage,
): Promise<{ stream: ReadableStream<Uint8Array>; fileName: string; mimeType: string; sizeBytes: number }> {
  if (!can(actor, "documents.view")) throw new DomainError("FORBIDDEN");
  const d = await prisma.patientDocument.findUnique({
    where: { id: documentId },
    select: { id: true, patientId: true, storageKey: true, fileName: true, mimeType: true, sizeBytes: true, deletedAt: true },
  });
  if (!d || d.deletedAt) throw new DomainError("NOT_FOUND", "Documentul nu a fost găsit.");
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await store.stream(d.storageKey);
  } catch {
    throw new DomainError("NOT_FOUND", "Fișierul documentului lipsește din arhivă.");
  }
  await audit(
    { action: "document.download", entityType: "PatientDocument", entityId: d.id, patientId: d.patientId },
    { actor },
  );
  return { stream, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes };
}

/** Soft delete (ADMIN only): the row stays for the record, the file stays until anonymisation. */
export async function softDeleteDocument(actor: CurrentUser, patientId: string, documentId: string, now: Date = new Date()): Promise<void> {
  if (!can(actor, "documents.delete")) throw new DomainError("FORBIDDEN", "Doar un administrator poate șterge documente.");
  await prisma.$transaction(async (tx) => {
    const d = await tx.patientDocument.findFirst({ where: { id: documentId, patientId }, select: { id: true, deletedAt: true } });
    if (!d) throw new DomainError("NOT_FOUND", "Documentul nu a fost găsit.");
    if (d.deletedAt) throw new DomainError("CONFLICT", "Documentul a fost deja șters.");
    await tx.patientDocument.update({ where: { id: d.id }, data: { deletedAt: now } });
    await audit({ action: "document.delete", entityType: "PatientDocument", entityId: d.id, patientId }, { actor, db: tx });
  });
}

/** „1,2 MB”, „340 KB”. */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(n / 1024)).toLocaleString("ro-RO")} KB`;
}
