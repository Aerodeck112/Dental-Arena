import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { getCookie, resetRequest, setRequestCookie } from "@/lib/__tests__/helpers/next-request";
import { uniqueTag } from "@/lib/__tests__/helpers/test-db";
import { SESSION_COOKIE, createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { previewTemplate, resetTemplateAction, saveTemplateAction } from "@/app/(crm)/crm/(app)/mesaje/actions";
import { sendMessage } from "../actions";

/**
 * Mesaje actions (WP5): manual send (`messages.send`: ADMIN, RECEPTIE) and the template editor
 * (`templates.manage`: ADMIN only), run as real Server Actions with a signed session.
 */

const tag = uniqueTag("mesaje");
const ids: Record<"ADMIN" | "RECEPTIE" | "MEDIC", string> = { ADMIN: "", RECEPTIE: "", MEDIC: "" };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function signInAs(role: keyof typeof ids): Promise<void> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: ids[role] } });
  resetRequest();
  await createSession({ id: u.id, role: u.role, sessionVersion: u.sessionVersion });
  const token = getCookie(SESSION_COOKIE)!.value;
  resetRequest({ "x-da-path": "/crm/mesaje", "x-forwarded-for": "203.0.113.9" });
  setRequestCookie(SESSION_COOKIE, token);
}

beforeAll(async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  for (const role of ["ADMIN", "RECEPTIE", "MEDIC"] as const) {
    const u = await prisma.user.create({
      data: { email: `${tag}-${role.toLowerCase()}@example.com`, passwordHash: "x", role, firstName: "Test", lastName: role },
    });
    ids[role] = u.id;
  }
});

afterAll(async () => {
  await prisma.messageTemplate.deleteMany({ where: { key: "cancel.sms" } });
  await prisma.messageLog.deleteMany({ where: { sentById: { in: Object.values(ids) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  vi.restoreAllMocks();
});

describe("sendMessage (SendMessageDialog)", () => {
  it("reports every missing field of a free e-mail in one submit", async () => {
    await signInAs("RECEPTIE");
    const r = await sendMessage(form({ channel: "EMAIL", to: "", subject: "", body: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("VALIDATION");
    expect(Object.keys(r.fieldErrors ?? {}).sort()).toEqual(["body", "subject", "to"]);
    expect(r.fieldErrors?.to?.[0]).toContain("e-mail");
  });

  it("sends an SMS to a typed number as GSM-7 and logs who sent it", async () => {
    await signInAs("RECEPTIE");
    const r = await sendMessage(form({ channel: "SMS", to: "0744 555 777", body: "Vă așteptăm mâine la control, în Luduș." }));
    expect(r).toMatchObject({ ok: true, data: { status: "SIMULAT" } });
    const log = await prisma.messageLog.findFirstOrThrow({ where: { sentById: ids.RECEPTIE }, orderBy: { createdAt: "desc" } });
    expect(log).toMatchObject({ channel: "SMS", kind: "MANUAL", status: "SIMULAT", to: "+40744555777", provider: "console" });
    expect(log.body).toBe("Va asteptam maine la control, in Ludus.");
  });

  it("rejects an SMS longer than 640 characters and refuses a MEDIC", async () => {
    await signInAs("ADMIN");
    const long = await sendMessage(form({ channel: "SMS", to: "0744555777", body: "a".repeat(641) }));
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.fieldErrors?.body?.[0]).toContain("640");
    await signInAs("MEDIC");
    const denied = await sendMessage(form({ channel: "SMS", to: "0744555777", body: "Test" }));
    expect(denied).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("template editor actions", () => {
  it("are ADMIN only", async () => {
    await signInAs("RECEPTIE");
    expect(await previewTemplate({ key: "cancel.sms", body: "Test" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await saveTemplateAction(form({ key: "cancel.sms", body: "Test", active: "on" }))).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("preview with sample data, flag unknown variables and count SMS segments", async () => {
    await signInAs("ADMIN");
    const r = await previewTemplate({ key: "cancel.sms", body: "Dental Arena: {{prenume}}, ora {{ora}} {{motiv}} {{necunoscut}}" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.text).toBe("Dental Arena: Maria, ora 10:30  ");
    expect(r.data.problems.body).toHaveLength(2);
    expect(r.data.sms).toMatchObject({ encoding: "GSM-7", segments: 1, perSegment: 160 });
  });

  it("save an override, refuse unknown variables, then return to the default text", async () => {
    await signInAs("ADMIN");
    const bad = await saveTemplateAction(form({ key: "cancel.sms", body: "Anulat {{necunoscut}}" }));
    expect(bad.ok).toBe(false);
    const ok = await saveTemplateAction(form({ key: "cancel.sms", body: "Programarea de {{data}} a fost anulată. {{telefonClinica}}" }));
    expect(ok).toMatchObject({ ok: true, data: { key: "cancel.sms" } });
    const row = await prisma.messageTemplate.findUniqueOrThrow({ where: { key: "cancel.sms" } });
    expect(row).toMatchObject({ active: false, updatedById: ids.ADMIN });
    expect(await resetTemplateAction({ key: "cancel.sms" })).toMatchObject({ ok: true });
    expect(await prisma.messageTemplate.count({ where: { key: "cancel.sms" } })).toBe(0);
    const audits = await prisma.auditLog.count({ where: { actorId: ids.ADMIN, action: "template.update" } });
    expect(audits).toBe(2);
  });
});
