import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});

import type { CurrentUser } from "../auth/dal";
import { audit } from "../audit";
import { prisma } from "../db";
import { DomainError } from "../errors";
import { SEQUENCE_KEYS, nextSequence } from "../sequences";
import { SETTINGS_DEFAULTS, SETTING_KEYS, getSettings, isSettingKey, saveSettings, type SettingKey } from "../settings";
import { mergeSettings } from "../settings-schema";
import { uniqueTag } from "./helpers/test-db";

const tag = uniqueTag("set");
const admin: CurrentUser = {
  id: `${tag}-admin`,
  role: "ADMIN",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Test",
  displayName: "Admin Test",
  doctorId: null,
  homeLocationId: null,
  locationIds: [],
  theme: "SISTEM",
  density: "COMPACT",
  mustChangePassword: false,
};

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
  await prisma.setting.deleteMany({ where: { key: "reminders" } });
  await prisma.numberSequence.deleteMany({ where: { key: { startsWith: tag } } });
});

describe("settings (§7.4)", () => {
  it("has exactly the six keys with valid defaults", () => {
    expect(SETTING_KEYS).toEqual(["clinic", "booking", "reminders", "invoicing", "gdpr", "ui"]);
    for (const key of SETTING_KEYS) expect(mergeSettings(key, null)).toEqual(SETTINGS_DEFAULTS[key]);
    expect(SETTINGS_DEFAULTS.booking.slotStepMinutes).toBe(15);
    expect(SETTINGS_DEFAULTS.invoicing.invoiceSeries).toBe("DA");
    expect(SETTINGS_DEFAULTS.ui.defaultDensity).toBe("COMPACT");
    expect(isSettingKey("booking")).toBe(true);
    expect(isSettingKey("necunoscut")).toBe(false);
  });

  it("merges stored values over the defaults and drops invalid or unknown fields", () => {
    expect(mergeSettings("booking", { slotStepMinutes: 30, horizonDays: -1, extra: true })).toEqual({
      ...SETTINGS_DEFAULTS.booking,
      slotStepMinutes: 30,
    });
    expect(mergeSettings("ui", "nu-este-obiect")).toEqual(SETTINGS_DEFAULTS.ui);
  });

  it("reads defaults without a row, saves, audits field names and reads back", async () => {
    await prisma.setting.deleteMany({ where: { key: "reminders" } });
    expect(await getSettings("reminders")).toEqual(SETTINGS_DEFAULTS.reminders);

    await saveSettings("reminders", { ...SETTINGS_DEFAULTS.reminders, hoursBefore: 48 }, admin);
    expect((await getSettings("reminders")).hoursBefore).toBe(48);

    const row = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "settings.update" } });
    expect(row?.entityId).toBe("reminders");
    expect(row?.actorRole).toBe("ADMIN");
    expect(JSON.parse(row?.metadata ?? "{}").fields).toContain("hoursBefore");
    expect(row?.metadata).not.toContain("48");
  });

  it("rejects invalid values, unknown fields and unknown keys", async () => {
    await expect(
      saveSettings("reminders", { ...SETTINGS_DEFAULTS.reminders, hoursBefore: 1 }, admin),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      saveSettings("reminders", { ...SETTINGS_DEFAULTS.reminders, extra: 1 } as typeof SETTINGS_DEFAULTS.reminders, admin),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveSettings("necunoscut" as SettingKey, {} as never, admin)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("audit", () => {
  it("writes an append-only row without an IP outside a request", async () => {
    await audit(
      { action: "patient.cnp.reveal", entityType: "Patient", entityId: `${tag}-p`, patientId: null, metadata: { field: "cnp" } },
      { actor: admin },
    );
    const row = await prisma.auditLog.findFirst({ where: { entityId: `${tag}-p` } });
    expect(row).toMatchObject({
      action: "patient.cnp.reveal",
      actorId: admin.id,
      actorName: "Admin Test",
      actorRole: "ADMIN",
      ipHash: null,
      metadata: JSON.stringify({ field: "cnp" }),
    });
  });
});

describe("nextSequence", () => {
  it("counts from 1 without gaps inside the caller's transaction", async () => {
    const key = `${tag}-${SEQUENCE_KEYS.invoice("DA")}`;
    const numbers = [];
    for (let i = 0; i < 3; i += 1) numbers.push(await prisma.$transaction((tx) => nextSequence(tx, key)));
    expect(numbers).toEqual([1, 2, 3]);
  });

  it("rolls back with the transaction", async () => {
    const key = `${tag}-${SEQUENCE_KEYS.patient}`;
    await prisma.$transaction((tx) => nextSequence(tx, key));
    await expect(
      prisma.$transaction(async (tx) => {
        await nextSequence(tx, key);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await prisma.$transaction((tx) => nextSequence(tx, key))).toBe(2);
  });

  it("names the shared keys", () => {
    expect(SEQUENCE_KEYS.patient).toBe("PACIENT");
    expect(SEQUENCE_KEYS.invoice("DA")).toBe("FACTURA:DA");
    expect(SEQUENCE_KEYS.receipt("DAC")).toBe("CHITANTA:DAC");
  });
});
