import "server-only";
import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

/**
 * File storage for patient documents (docs/architecture.md §9.5). Files live on local disk under
 * `env.STORAGE_DIR` (gitignored, outside `public/`) and are served only through the
 * authenticated download route. Keys are generated here, never taken from a request, and every
 * key is validated against `STORAGE_KEY_RE`, so path traversal is impossible.
 */

export interface FileStorage {
  put(key: string, data: Uint8Array, mime: string): Promise<void>;
  stream(key: string): Promise<ReadableStream<Uint8Array>>;
  remove(key: string): Promise<void>;
}

export const STORAGE_KEY_RE = /^patients\/[a-z0-9]+\/[a-z0-9]+\.(jpg|png|webp|pdf|dcm)$/;

export type StorageExt = "jpg" | "png" | "webp" | "pdf" | "dcm";

export function isValidStorageKey(key: string): boolean {
  return STORAGE_KEY_RE.test(key);
}

/** „patients/<patientId>/<random>.<ext>”. The random part is 24 lowercase hex characters. */
export function newStorageKey(patientId: string, ext: StorageExt): string {
  const key = `patients/${patientId}/${randomBytes(12).toString("hex")}.${ext}`;
  if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
  return key;
}

function resolveKey(root: string, key: string): string {
  if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
  const base = path.resolve(root);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export function createLocalStorage(root: string): FileStorage {
  return {
    async put(key, data) {
      const full = resolveKey(root, key);
      await mkdir(path.dirname(full), { recursive: true });
      // `wx`: a key is never overwritten.
      await writeFile(full, data, { flag: "wx", mode: 0o600 });
    },
    async stream(key) {
      const full = resolveKey(root, key);
      await stat(full);
      return Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>;
    },
    async remove(key) {
      const full = resolveKey(root, key);
      await rm(full, { force: true });
    },
  };
}

export const storage: FileStorage = createLocalStorage(env.STORAGE_DIR);
