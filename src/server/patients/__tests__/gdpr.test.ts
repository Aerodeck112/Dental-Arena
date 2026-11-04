import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const { isolatedTestDb } = await import("./isolated-db");
  process.env.DATABASE_URL = isolatedTestDb("gdpr");
});

import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { uploadDocument } from "../documents";
import {
  ANONYMIZED_LEAD_DATA,
  ANONYMIZED_MESSAGE_DATA,
  anonymizedPatientData,
  anonymizePatient,
  createDataRequest,
  exportPatientData,
  listDataRequests,
  requestDeadline,
  updateDataRequest,
} from "../gdpr";
import { createPatient, recordPatientView } from "../service";
import { createLocalStorage } from "../storage";
import { makeUsers, runTag } from "./fixtures";

const tag = runTag();
let admin: CurrentUser;
let medic: CurrentUser;
const store = createLocalStorage(mkdtempSync(path.join(tmpdir(), "wp7-gdpr-")));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

beforeAll(async () => {
  ({ admin, medic } = await makeUsers(tag));
});

describe("anonymisation field map (§3.2 invariant 11)", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  const d = anonymizedPatientData(42, now);
  it("replaces the name and nulls CNP, phone, e-mail and address", () => {
    expect(`${d.firstName} ${d.lastName}`).toBe("Pacient anonimizat #42");
    for (const k of ["cnpEncrypted", "cnpHash", "phone", "email", "street", "city", "county"] as const) expect(d[k]).toBeNull();
    expect(d.searchText).not.toMatch(/[A-ZĂÂÎȘȚ]/);
    expect(d.anonymizedAt).toBe(now);
  });
  it("leaves the clinical fields alone", () => {
    expect(Object.keys(d)).not.toContain("birthDate");
    expect(Object.keys(d)).not.toContain("sex");
  });
  it("redacts leads and messages", () => {
    expect(ANONYMIZED_LEAD_DATA).toMatchObject({ name: "Cerere anonimizată", phone: null, email: null, message: null });
    expect(ANONYMIZED_MESSAGE_DATA).toMatchObject({ to: "[anonimizat]", body: "[anonimizat]" });
  });
});

describe("export and anonymise", () => {
  it("exports everything, then anonymises in one go", async () => {
    const p = await createPatient(prisma, { firstName: "Elena", lastName: `Rus${tag}`, phone: "+40700000999", email: `elena${tag}@example.com` }, admin);
    await prisma.medicalHistory.create({ data: { patientId: p.id, allergies: "penicilină" } });
    await prisma.patientNote.create({ data: { patientId: p.id, body: "Sună după ora 16", clinical: false } });
    await prisma.patientNote.create({ data: { patientId: p.id, body: "Sensibilitate 36", clinical: true } });
    await prisma.lead.create({ data: { source: "TELEFON", name: "Elena Rus", phone: "+40700000999", message: "Durere", patientId: p.id } });
    await prisma.messageLog.create({ data: { channel: "SMS", kind: "REMINDER", status: "SIMULAT", to: "+40700000999", body: "Bună ziua, Elena", patientId: p.id } });
    await uploadDocument(medic, { patientId: p.id, kind: "FOTOGRAFIE", fileName: "poza.png", mimeType: "image/png", bytes: PNG }, store);

    await expect(exportPatientData(medic, p.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const exp = await exportPatientData(admin, p.id);
    const json = JSON.stringify(exp.data);
    expect(exp.fileName).toMatch(new RegExp(`^pacient-${p.fileNumber}-export-\\d{4}-\\d{2}-\\d{2}\\.json$`));
    expect(json).toContain("penicilină");
    expect(json).not.toContain("storageKey");
    expect(json).not.toContain("cnpHash");
    expect((exp.data.documents as unknown[]).length).toBe(1);

    await expect(anonymizePatient(admin, p.id, p.fileNumber + 1, { store })).rejects.toMatchObject({ code: "VALIDATION" });
    const r = await anonymizePatient(admin, p.id, p.fileNumber, { store });
    expect(r.documentsRemoved).toBe(1);
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: p.id } });
    expect(after).toMatchObject({ firstName: "Pacient", lastName: `anonimizat #${p.fileNumber}`, phone: null, email: null });
    expect(after.anonymizedAt).not.toBeNull();
    expect(await prisma.medicalHistory.findUnique({ where: { patientId: p.id } })).toMatchObject({ allergies: "penicilină" });
    const notes = await prisma.patientNote.findMany({ where: { patientId: p.id }, orderBy: { clinical: "asc" } });
    expect(notes.map((n) => n.body)).toEqual(["[anonimizat]", "Sensibilitate 36"]);
    expect(await prisma.lead.findFirst({ where: { patientId: p.id } })).toMatchObject({ name: "Cerere anonimizată", phone: null });
    expect(await prisma.messageLog.findFirst({ where: { patientId: p.id } })).toMatchObject({ body: "[anonimizat]", to: "[anonimizat]" });
    expect(await prisma.patientDocument.count({ where: { patientId: p.id, deletedAt: null } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { patientId: p.id, action: { in: ["patient.export", "patient.anonymize"] } } })).toBe(2);
    await expect(anonymizePatient(admin, p.id, p.fileNumber, { store })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("patient.view audit", () => {
  it("is written at most once per user, patient and hour", async () => {
    const p = await createPatient(prisma, { firstName: "Ion", lastName: `Pop${tag}` }, admin);
    const t0 = new Date();
    expect(await recordPatientView(medic, p.id, t0)).toBe(true);
    expect(await recordPatientView(medic, p.id, new Date(t0.getTime() + 10 * 60_000))).toBe(false);
    expect(await recordPatientView(admin, p.id, t0)).toBe(true);
  });
});

describe("request register", () => {
  it("computes due dates and highlights overdue requests", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    expect(requestDeadline(new Date("2026-10-18T10:00:00Z"), "PRIMITA", now)).toEqual({ daysLeft: 12, overdue: false });
    expect(requestDeadline(new Date("2026-10-01T10:00:00Z"), "IN_LUCRU", now)).toEqual({ daysLeft: -5, overdue: true });
    expect(requestDeadline(new Date("2026-10-01T10:00:00Z"), "FINALIZATA", now).overdue).toBe(false);

    const { id } = await createDataRequest(admin, { type: "ACCES", requesterName: `Solicitant ${tag}`, receivedAt: "2026-08-01" }, now);
    const rows = await listDataRequests(admin, {}, now);
    const row = rows.find((r) => r.id === id)!;
    expect(row.dueAt.slice(0, 10)).toBe("2026-08-31");
    expect(row.overdue).toBe(true);
    await expect(updateDataRequest(admin, { requestId: id, status: "FINALIZATA" })).rejects.toMatchObject({ code: "VALIDATION" });
    await updateDataRequest(admin, { requestId: id, status: "FINALIZATA", outcome: "Copie trimisă pe e-mail." });
    const done = (await listDataRequests(admin, {}, now)).find((r) => r.id === id)!;
    expect(done).toMatchObject({ status: "FINALIZATA", overdue: false });
  });
});
