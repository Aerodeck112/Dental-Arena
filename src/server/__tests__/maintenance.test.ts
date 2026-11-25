import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5.db";
});

import { prisma } from "@/lib/db";
import { GET as cronMaintenance } from "@/app/api/cron/maintenance/route";
import { ANONYMIZED_LEAD_NAME, REDACTED_MESSAGE_BODY, runMaintenance } from "../maintenance";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const tag = `mnt${process.pid}${Date.now().toString(36)}`;
const gdpr = { consentTextVersion: "gdpr-2026-10", leadRetentionDays: 180, messageBodyRetentionDays: 365 };

const ids: Record<string, string> = {};

beforeAll(async () => {
  const lead = (name: string, status: "NOU" | "CONTACTAT" | "PROGRAMAT" | "PIERDUT", updatedDaysAgo: number, extra: object = {}) =>
    prisma.lead.create({
      data: {
        source: "FORMULAR_CONTACT",
        status,
        name,
        phone: "+40744999001",
        email: `${tag}@example.com`,
        message: "Mă doare o măsea.",
        createdAt: ago(updatedDaysAgo + 5),
        updatedAt: ago(updatedDaysAgo),
        ...extra,
      },
    });
  ids.lostOld = (await lead("Ion Pierdut", "PIERDUT", 200)).id;
  ids.newOld = (await lead("Ana Uitata", "NOU", 181)).id;
  ids.newRecent = (await lead("Dan Recent", "NOU", 10)).id;
  ids.convertedOld = (await lead("Eva Convertita", "PROGRAMAT", 400, { convertedAt: ago(390) })).id;
  await prisma.leadActivity.create({ data: { leadId: ids.lostOld, type: "NOTA", body: "A sunat de la 0744 999 001." } });

  ids.bucketOld = (await prisma.rateLimitBucket.create({ data: { key: `${tag}:old`, count: 3, resetAt: ago(1) } })).key;
  ids.bucketLive = (await prisma.rateLimitBucket.create({ data: { key: `${tag}:live`, count: 1, resetAt: new Date(NOW.getTime() + 60_000) } })).key;

  ids.msgOld = (
    await prisma.messageLog.create({
      data: { channel: "SMS", kind: "REMINDER", status: "SIMULAT", to: "+40744999002", body: "Text vechi", createdAt: ago(400) },
    })
  ).id;
  ids.msgNew = (
    await prisma.messageLog.create({
      data: { channel: "SMS", kind: "REMINDER", status: "SIMULAT", to: "+40744999003", body: "Text nou", createdAt: ago(30) },
    })
  ).id;
});

describe("runMaintenance", () => {
  it("anonymises stale unconverted leads, purges expired buckets and redacts old message bodies", async () => {
    const r = await runMaintenance(NOW, { gdpr });
    expect(r.leadsAnonymized).toBeGreaterThanOrEqual(2);
    expect(r.rateLimitBucketsPurged).toBeGreaterThanOrEqual(1);
    expect(r.messageBodiesRedacted).toBeGreaterThanOrEqual(1);

    for (const id of [ids.lostOld, ids.newOld]) {
      const l = await prisma.lead.findUniqueOrThrow({ where: { id } });
      expect(l).toMatchObject({ name: ANONYMIZED_LEAD_NAME, phone: null, email: null, message: null });
    }
    expect((await prisma.leadActivity.findFirstOrThrow({ where: { leadId: ids.lostOld } })).body).toBeNull();
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: ids.newRecent } })).name).toBe("Dan Recent");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: ids.convertedOld } })).name).toBe("Eva Convertita");

    expect(await prisma.rateLimitBucket.findUnique({ where: { key: ids.bucketOld } })).toBeNull();
    expect(await prisma.rateLimitBucket.findUnique({ where: { key: ids.bucketLive } })).not.toBeNull();

    expect((await prisma.messageLog.findUniqueOrThrow({ where: { id: ids.msgOld } })).body).toBe(REDACTED_MESSAGE_BODY);
    expect((await prisma.messageLog.findUniqueOrThrow({ where: { id: ids.msgNew } })).body).toBe("Text nou");
  });

  it("is idempotent", async () => {
    await runMaintenance(NOW, { gdpr });
    const again = await runMaintenance(NOW, { gdpr });
    expect(again.leadsAnonymized).toBe(0);
    expect(again.messageBodiesRedacted).toBe(0);
  });

  it("runs from the cron route with the bearer token", async () => {
    const res = await cronMaintenance(
      new Request("http://localhost:3000/api/cron/maintenance", { headers: { authorization: "Bearer test-cron-secret" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ leadsAnonymized: expect.any(Number), rateLimitBucketsPurged: expect.any(Number) });
  });
});
