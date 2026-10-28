import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test.db";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdtempSync: mk } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir: td } = require("node:os") as typeof import("node:os");
  process.env.STORAGE_DIR = mk(`${td()}/da-media-`);
});

import type { CurrentUser } from "@/lib/auth/dal";
import { SITE_IMAGE_SLOTS } from "@/content/site-images";
import { getSiteImage, listSiteImages, mediaDir, mediaFilePath, readMediaFile, resetSiteImage, saveSiteImage } from "../site-images";

const admin: CurrentUser = {
  id: "media-admin",
  role: "ADMIN",
  email: "media@example.com",
  firstName: "Ana",
  lastName: "Admin",
  displayName: "Ana Admin",
  doctorId: null,
  homeLocationId: null,
  locationIds: [],
  theme: "SISTEM",
  density: "COMPACT",
  mustChangePassword: false,
};

async function photo(width: number, height: number): Promise<File> {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#2a7d5a" } }).jpeg().toBuffer();
  return new File([new Uint8Array(buf)], "poza.jpg", { type: "image/jpeg" });
}

describe("site photos", () => {
  it("has a default photo for every place, from the current site", async () => {
    for (const s of SITE_IMAGE_SLOTS) expect(s.default.src).toMatch(/^\/images\//);
    expect(new Set(SITE_IMAGE_SLOTS.map((s) => s.key)).size).toBe(SITE_IMAGE_SLOTS.length);
    expect((await getSiteImage("acasa.principala")).src).toBe("/images/clinica/perete-muschi.jpg");
  });

  it("only serves file names it created (no path traversal)", () => {
    expect(mediaFilePath("../.env")).toBeNull();
    expect(mediaFilePath("a/b.webp")).toBeNull();
    expect(mediaFilePath("acasa-principala-abc123.webp")).toBe(path.join(mediaDir(), "acasa-principala-abc123.webp"));
  });

  it("resizes an upload to WebP of at most 2400px and shows it at its place", async () => {
    await saveSiteImage("acasa.confort", await photo(4000, 3000), "Sala de așteptare", admin);
    const img = await getSiteImage("acasa.confort");
    expect(img.src).toMatch(/^\/media\/acasa-confort-[a-z0-9]+\.webp$/);
    expect(img.width).toBe(2400);
    expect(img.height).toBe(1800);
    expect(img.alt).toBe("Sala de așteptare");
    const data = await readMediaFile(img.src.slice("/media/".length));
    expect((await sharp(data!).metadata()).format).toBe("webp");
    const row = (await listSiteImages()).find((r) => r.key === "acasa.confort")!;
    expect(row.isDefault).toBe(false);
  });

  it("replacing a photo deletes the old file; reset brings back the default", async () => {
    await saveSiteImage("acasa.copii", await photo(800, 600), "", admin);
    const first = (await getSiteImage("acasa.copii")).src;
    await saveSiteImage("acasa.copii", await photo(900, 600), "", admin);
    const second = (await getSiteImage("acasa.copii")).src;
    expect(second).not.toBe(first);
    expect(existsSync(mediaFilePath(first.slice(7))!)).toBe(false);
    await resetSiteImage("acasa.copii", admin);
    expect((await getSiteImage("acasa.copii")).src).toBe("/images/clinica/cabinet-plaja.jpg");
    expect(existsSync(mediaFilePath(second.slice(7))!)).toBe(false);
  });

  it("refuses files that are not photos, and unknown places", async () => {
    const text = new File(["nu este o poză"], "poza.jpg", { type: "image/jpeg" });
    await expect(saveSiteImage("acasa.tehnologie", text, "", admin)).rejects.toMatchObject({ code: "VALIDATION" });
    const pdf = new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
    await expect(saveSiteImage("acasa.tehnologie", pdf, "", admin)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveSiteImage("nu.exista", await photo(10, 10), "", admin)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(readdirSync(mediaDir()).every((f) => f.endsWith(".webp"))).toBe(true);
  });
});

