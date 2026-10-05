import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});
vi.mock("next/headers", async () => (await import("./helpers/next-request")).nextHeadersMock);

const auth = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock("../auth/dal", () => ({ getCurrentUser: async () => auth.user }));

import { redirect } from "next/navigation";
import { DomainError, crmAction, fail, formDataToObject, publicAction, zodFieldErrors } from "../actions";
import { prisma } from "../db";
import { ERROR_MESSAGES } from "../errors";
import { FORM_TS_FIELD, HONEYPOT_FIELD, signFormTimestamp } from "../honeypot";
import { zPhoneRo, zText } from "../validation/common";
import { expectRedirect, resetRequest } from "./helpers/next-request";
import { uniqueTag } from "./helpers/test-db";

const tag = uniqueTag("act");

function user(role: "ADMIN" | "MEDIC" | "RECEPTIE") {
  return {
    id: `user-${role}`,
    role,
    email: `${role.toLowerCase()}@example.com`,
    firstName: "Test",
    lastName: role,
    displayName: `Test ${role}`,
    doctorId: role === "MEDIC" ? "doctor-1" : null,
    homeLocationId: null,
    theme: "SISTEM",
    density: "COMPACT",
    mustChangePassword: false,
  };
}

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

beforeEach(() => {
  auth.user = null;
  resetRequest({ "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}, 10.0.0.1` });
});

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: tag } } });
});

describe("formDataToObject", () => {
  it("converts FormData as §7.1 describes", () => {
    const fd = form({ name: "Maria", empty: "", agree: "on", tag: ["a", "b"], $ACTION_ID_abc: "x" });
    expect(formDataToObject(fd)).toEqual({ name: "Maria", empty: undefined, agree: true, tag: ["a", "b"] });
  });

  it("drops empty values from repeated keys and empty file inputs", () => {
    const fd = form({ tag: ["a", "", "b"] });
    fd.append("file", new File([], ""));
    expect(formDataToObject(fd)).toEqual({ tag: ["a", "b"], file: undefined });
  });
});

describe("crmAction", () => {
  const save = crmAction(
    {
      permission: "leads.manage",
      schema: z.object({ name: zText(20), phone: zPhoneRo }),
      successMessage: (d: { name: string }) => `Salvat: ${d.name}`,
    },
    async (input, { user: u }) => ({ name: input.name, phone: input.phone, by: u.id }),
  );

  it("returns UNAUTHENTICATED without a user", async () => {
    expect(await save({ name: "Ana", phone: "0744123456" })).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      error: ERROR_MESSAGES.UNAUTHENTICATED,
    });
  });

  it("returns FORBIDDEN without the permission", async () => {
    auth.user = user("MEDIC");
    const r = await save({ name: "Ana", phone: "0744123456" });
    expect(r.ok === false && r.code).toBe("FORBIDDEN");
  });

  it("validates FormData and reports field errors", async () => {
    auth.user = user("RECEPTIE");
    const r = await save(form({ name: "", phone: "123" }));
    expect(r).toEqual({
      ok: false,
      code: "VALIDATION",
      error: ERROR_MESSAGES.VALIDATION,
      fieldErrors: {
        name: ["Completați acest câmp."],
        phone: ["Introduceți un număr de telefon, de exemplu 0745 123 456."],
      },
    });
  });

  it("runs the handler with parsed input, for plain objects and for useActionState", async () => {
    auth.user = user("RECEPTIE");
    const expected = {
      ok: true,
      data: { name: "Ana", phone: "+40744123456", by: "user-RECEPTIE" },
      message: "Salvat: Ana",
    };
    expect(await save({ name: " Ana ", phone: "0744 123 456" })).toEqual(expected);
    expect(await save(null, form({ name: "Ana", phone: "0744 123 456" }))).toEqual(expected);
  });

  it("maps DomainError, including field errors and conflict details", async () => {
    auth.user = user("ADMIN");
    const move = crmAction({ permission: "appointments.manage", schema: z.object({}) }, async () => {
      throw new DomainError("CONFLICT", "Medicul are deja o programare la această oră.", {
        details: { conflicts: [{ kind: "DOCTOR_BUSY", severity: "block", message: "Ocupat" }] },
      });
    });
    expect(await move({})).toEqual({
      ok: false,
      code: "CONFLICT",
      error: "Medicul are deja o programare la această oră.",
      details: { conflicts: [{ kind: "DOCTOR_BUSY", severity: "block", message: "Ocupat" }] },
    });

    const stale = crmAction({ permission: "appointments.manage", schema: z.object({}) }, async () => fail("STALE"));
    expect(await stale({})).toMatchObject({ ok: false, code: "STALE", error: ERROR_MESSAGES.STALE });
  });

  it("hides unexpected errors behind a generic message with an error id, without logging the message", async () => {
    auth.user = user("ADMIN");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = crmAction({ permission: "dashboard.view", schema: z.object({}) }, async () => {
      throw new Error("CNP 1960523264411 al pacientei Maria Suciu");
    });
    const r = await boom({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("INTERNAL");
      expect(r.error).toMatch(/^A apărut o eroare neașteptată\. Încercați din nou\. \(cod [0-9a-f]{8}\)$/);
      expect(r.error).not.toContain("1960523264411");
    }
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("1960523264411");
    expect(logged).not.toContain("Maria");
    spy.mockRestore();
  });

  it("maps Prisma's not-found and unique errors", async () => {
    auth.user = user("ADMIN");
    const notFound = crmAction({ permission: "dashboard.view", schema: z.object({}) }, async () => {
      throw Object.assign(new Error("x"), { code: "P2025" });
    });
    expect(await notFound({})).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const duplicate = crmAction({ permission: "dashboard.view", schema: z.object({}) }, async () => {
      throw Object.assign(new Error("x"), { code: "P2002" });
    });
    expect(await duplicate({})).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("lets a handler redirect after success", async () => {
    auth.user = user("ADMIN");
    const create = crmAction({ permission: "dashboard.view", schema: z.object({}) }, async () => {
      redirect("/crm/pacienti/nou");
    });
    expect(await expectRedirect(() => create({}))).toBe("/crm/pacienti/nou");
  });
});

describe("publicAction", () => {
  const schema = z.object({ name: zText(80), phone: zPhoneRo });
  const handler = vi.fn(async (input: z.output<typeof schema>, ctx: { ipHash: string }) => ({
    name: input.name,
    ipHash: ctx.ipHash,
  }));

  function humanForm(extra: Record<string, string> = {}) {
    return form({
      name: "Maria",
      phone: "0744 123 456",
      [HONEYPOT_FIELD]: "",
      [FORM_TS_FIELD]: signFormTimestamp(new Date(Date.now() - 8_000)),
      ...extra,
    });
  }

  beforeEach(() => {
    handler.mockClear();
  });

  it("gives bots a fake success without running the handler", async () => {
    const contact = publicAction(
      { schema, honeypot: true, successMessage: "Mulțumim!", botResult: () => ({ name: "", ipHash: "" }) },
      handler,
    );
    expect(await contact(humanForm({ [HONEYPOT_FIELD]: "spam" }))).toEqual({
      ok: true,
      data: { name: "", ipHash: "" },
      message: "Mulțumim!",
    });
    expect(await contact(humanForm({ [FORM_TS_FIELD]: signFormTimestamp() }))).toMatchObject({ ok: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler for people, with a hashed IP and never the IP itself", async () => {
    const contact = publicAction({ schema, honeypot: true }, handler);
    const r = await contact(humanForm());
    expect(r.ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const ctx = handler.mock.calls[0][1];
    expect(ctx.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx.ipHash).not.toContain("198.51.100");
  });

  it("applies IP rate limits before validation, with the §8.2 message", async () => {
    const limited = publicAction(
      { schema, rateLimit: [{ bucket: `${tag}:ip`, limit: 2, windowSec: 600 }] },
      handler,
    );
    expect((await limited(humanForm())).ok).toBe(true);
    expect((await limited(form({ name: "" }))).ok).toBe(false);
    const third = await limited(humanForm());
    expect(third).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      error: "Ați trimis prea multe cereri. Încercați din nou peste câteva minute sau sunați-ne.",
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("applies keyed rate limits on the validated input, hashing the key", async () => {
    const limited = publicAction(
      { schema, rateLimit: [{ bucket: `${tag}:phone`, limit: 1, windowSec: 600, key: (i) => i.phone }] },
      handler,
    );
    expect((await limited(humanForm())).ok).toBe(true);
    resetRequest({ "x-forwarded-for": "192.0.2.99" }); // another IP, same phone
    expect(await limited(humanForm())).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect((await limited(humanForm({ phone: "0744 999 888" }))).ok).toBe(true);
    const keys = await prisma.rateLimitBucket.findMany({ where: { key: { startsWith: `${tag}:phone` } } });
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => !k.key.includes("744123456") && !k.key.includes("744999888"))).toBe(true);
  });
});

describe("zodFieldErrors", () => {
  it("groups messages by path and puts root errors under „form”", () => {
    const schema = z
      .object({ a: z.string().min(2, "prea scurt"), b: z.object({ c: z.number({ error: "număr" }) }) })
      .refine(() => false, { error: "formular invalid" });
    const r = schema.safeParse({ a: "x", b: { c: "y" } });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodFieldErrors(r.error)).toEqual({ a: ["prea scurt"], "b.c": ["număr"] });
    const root = z.object({ a: z.string() }).refine(() => false, { error: "formular invalid" }).safeParse({ a: "x" });
    if (!root.success) expect(zodFieldErrors(root.error)).toEqual({ form: ["formular invalid"] });
  });
});
