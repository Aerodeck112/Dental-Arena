import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import sharp, { type OutputInfo } from "sharp";
import { SITE_IMAGE_SLOTS, siteImageSlot, type SiteImageDefault } from "@/content/site-images";
import type { CurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";

/**
 * Photos uploaded from the CRM (site places and doctor portraits). They are resized to at most
 * 2400px, turned upright, stripped of EXIF (location, camera) and stored as WebP in
 * `STORAGE_DIR/media`, outside the build, so a new deploy on cPanel keeps them. They are served by
 * `/media/[file]`.
 */

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 2400;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"]);
const FILE_NAME = /^[a-z0-9-]+\.webp$/;

export function mediaDir(): string {
  return path.resolve(env.STORAGE_DIR, "media");
}

/** Absolute path of a served media file, or null for a name that is not ours (no traversal). */
export function mediaFilePath(name: string): string | null {
  return FILE_NAME.test(name) ? path.join(mediaDir(), name) : null;
}

export async function readMediaFile(name: string): Promise<Buffer | null> {
  const file = mediaFilePath(name);
  if (!file) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

const photoError = (message: string) => new DomainError("VALIDATION", message, { fieldErrors: { file: [message] } });

/** Checks, resizes and stores one photo; returns its public path and size. */
export async function storePhoto(file: File, baseName: string): Promise<{ path: string; width: number; height: number }> {
  if (file.size === 0) throw photoError("Alegeți o fotografie.");
  if (file.size > MAX_PHOTO_BYTES) throw photoError("Fotografia depășește 15 MB. Alegeți una mai mică.");
  if (file.type && !ACCEPTED.has(file.type)) throw photoError("Alegeți o fotografie JPG, PNG, WebP sau HEIC.");

  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw photoError("Fișierul nu este o fotografie validă. Alegeți altă fotografie.");
  }
  const safeBase = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "foto";
  const name = `${safeBase}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}.webp`;
  await mkdir(mediaDir(), { recursive: true });
  await writeFile(path.join(mediaDir(), name), out.data);
  return { path: `/media/${name}`, width: out.info.width, height: out.info.height };
}

/** Deletes a previously uploaded file; default photos under /images are never touched. */
export async function removeStoredPhoto(publicPath: string | null | undefined): Promise<void> {
  if (!publicPath?.startsWith("/media/")) return;
  const file = mediaFilePath(publicPath.slice("/media/".length));
  if (file) await rm(file, { force: true });
}

/** Every uploaded site photo, by place; memoised per request. */
const getUploaded = cache(async () => {
  const rows = await prisma.siteImage.findMany();
  return new Map(rows.map((r) => [r.key, r]));
});

/** The photo shown at a place: the uploaded one, or the default. */
export async function getSiteImage(key: string): Promise<SiteImageDefault> {
  const slot = siteImageSlot(key);
  if (!slot) throw new Error(`Loc de fotografie necunoscut: ${key}`);
  const row = (await getUploaded()).get(key);
  return row ? { src: row.path, width: row.width, height: row.height, alt: row.alt } : slot.default;
}

export async function getSiteImages<K extends string>(keys: readonly K[]): Promise<Record<K, SiteImageDefault>> {
  const entries = await Promise.all(keys.map(async (k) => [k, await getSiteImage(k)] as const));
  return Object.fromEntries(entries) as Record<K, SiteImageDefault>;
}

export type SiteImageRow = {
  key: string;
  group: string;
  label: string;
  hint: string;
  current: SiteImageDefault;
  isDefault: boolean;
  updatedAt: string | null;
};

/** For the CRM page: every place, its current photo and whether it was changed. */
export async function listSiteImages(): Promise<SiteImageRow[]> {
  const uploaded = await getUploaded();
  return SITE_IMAGE_SLOTS.map((s) => {
    const row = uploaded.get(s.key);
    return {
      key: s.key,
      group: s.group,
      label: s.label,
      hint: s.hint,
      current: row ? { src: row.path, width: row.width, height: row.height, alt: row.alt } : s.default,
      isDefault: !row,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function saveSiteImage(key: string, file: File, alt: string, actor: CurrentUser): Promise<void> {
  const slot = siteImageSlot(key);
  if (!slot) throw new DomainError("NOT_FOUND", "Locul fotografiei nu există.");
  const text = alt.trim() || slot.default.alt;
  const stored = await storePhoto(file, key);
  const before = await prisma.siteImage.findUnique({ where: { key }, select: { path: true } });
  await prisma.siteImage.upsert({
    where: { key },
    create: { key, path: stored.path, width: stored.width, height: stored.height, alt: text, updatedById: actor.id },
    update: { path: stored.path, width: stored.width, height: stored.height, alt: text, updatedById: actor.id },
  });
  await removeStoredPhoto(before?.path);
  await audit({ action: "media.update", entityType: "SiteImage", entityId: key, metadata: { key, label: slot.label } }, { actor });
}

/** „Reveniți la fotografia inițială”. */
export async function resetSiteImage(key: string, actor: CurrentUser): Promise<void> {
  const row = await prisma.siteImage.findUnique({ where: { key }, select: { path: true } });
  if (!row) return;
  await prisma.siteImage.delete({ where: { key } });
  await removeStoredPhoto(row.path);
  await audit({ action: "media.update", entityType: "SiteImage", entityId: key, metadata: { key, reset: true } }, { actor });
}

/** A doctor's portrait, uploaded from the profile in Echipă. */
export async function saveDoctorPhoto(doctorId: string, file: File, actor: CurrentUser): Promise<{ path: string }> {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { slug: true, photoPath: true } });
  if (!doctor) throw new DomainError("NOT_FOUND", "Profilul medicului nu există.");
  const stored = await storePhoto(file, `echipa-${doctor.slug}`);
  await prisma.doctor.update({ where: { id: doctorId }, data: { photoPath: stored.path } });
  await removeStoredPhoto(doctor.photoPath);
  await audit({ action: "media.update", entityType: "Doctor", entityId: doctorId, metadata: { photo: true } }, { actor });
  return { path: stored.path };
}

/** Removes the portrait: the site shows the monogram plate instead. */
export async function removeDoctorPhoto(doctorId: string, actor: CurrentUser): Promise<void> {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { photoPath: true } });
  if (!doctor) throw new DomainError("NOT_FOUND", "Profilul medicului nu există.");
  await prisma.doctor.update({ where: { id: doctorId }, data: { photoPath: null } });
  await removeStoredPhoto(doctor.photoPath);
  await audit({ action: "media.update", entityType: "Doctor", entityId: doctorId, metadata: { photo: false } }, { actor });
}
