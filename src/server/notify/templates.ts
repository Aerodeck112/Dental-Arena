import "server-only";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma, type Db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { DEFAULT_TEMPLATES } from "./default-templates";
import {
  TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  type ResolvedTemplate,
  type TemplateKey,
  type TemplateVariable,
  type TemplateVars,
} from "./types";

/**
 * Template engine and lookup (docs/architecture.md §9.2). Syntax: `{{variabila}}`. A
 * `MessageTemplate` row overrides the code default with the same key.
 */

const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function isTemplateKey(v: string): v is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(v);
}

/** Variables a template may use: patient templates never get `motiv` (no health data). */
export function allowedVariables(key: TemplateKey): readonly TemplateVariable[] {
  return DEFAULT_TEMPLATES[key].audience === "clinica"
    ? TEMPLATE_VARIABLES
    : TEMPLATE_VARIABLES.filter((v) => v !== "motiv");
}

/** Names used in `{{…}}` placeholders, in order of first appearance. */
export function templateVariables(source: string): string[] {
  const seen: string[] = [];
  for (const m of source.matchAll(PLACEHOLDER)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/**
 * Problems with a template text, as Romanian messages ([] = valid): unknown variables, `motiv`
 * in a patient template, and unbalanced braces.
 */
export function templateProblems(source: string, allowed: readonly string[]): string[] {
  const problems: string[] = [];
  const unknown = templateVariables(source).filter((v) => !allowed.includes(v));
  for (const name of unknown) {
    problems.push(
      name === "motiv"
        ? "Variabila {{motiv}} nu se folosește în mesajele către pacienți: motivul vizitei nu pleacă din clinică."
        : name === ""
          ? "Există o variabilă fără nume: {{}}. Ștergeți-o sau completați numele."
          : `Variabila {{${name}}} nu există. Folosiți doar variabilele din listă.`,
    );
  }
  const stripped = source.replace(PLACEHOLDER, "");
  if (stripped.includes("{{") || stripped.includes("}}")) {
    problems.push("Acoladele nu sunt închise corect. Scrieți variabilele așa: {{prenume}}.");
  }
  return problems;
}

/** Replaces `{{name}}` with the value; unknown or missing variables become an empty string. */
export function renderText(source: string, vars: TemplateVars): string {
  return source.replace(PLACEHOLDER, (_m, name: string) => {
    const value = (vars as Record<string, string | undefined>)[name];
    return value ?? "";
  });
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const URL_IN_ESCAPED_TEXT = /https?:\/\/[^\s<>"']+/g;

/**
 * Plain e-mail text → simple inline-styled HTML (§9.1): the text is escaped first, then each URL
 * becomes a link. No remote images. Values from variables can never inject markup.
 */
export function textToEmailHtml(text: string, clinicName = "Dental Arena"): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const html = escapeHtml(p)
        .replace(URL_IN_ESCAPED_TEXT, (url) => {
          const trimmed = url.replace(/[.,;:)]+$/, "");
          const rest = url.slice(trimmed.length);
          return `<a href="${trimmed}" style="color:#1F6B4C;text-decoration:underline">${trimmed}</a>${rest}`;
        })
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px 0">${html}</p>`;
    })
    .join("\n");
  return [
    '<!doctype html><html lang="ro"><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:24px;background:#F4F7F5;color:#252E2C;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">',
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;padding:24px;border-radius:8px">',
    `<p style="margin:0 0 20px 0;font-size:18px;font-weight:bold;color:#1F6B4C">${escapeHtml(clinicName)}</p>`,
    paragraphs,
    "</div></body></html>",
  ].join("\n");
}

/** The effective template for a key: DB row when present, else the code default. */
export async function getTemplate(key: TemplateKey, db: Db = prisma): Promise<ResolvedTemplate> {
  const def = DEFAULT_TEMPLATES[key];
  const row = await db.messageTemplate.findUnique({
    where: { key },
    select: { subject: true, body: true, active: true, updatedAt: true },
  });
  if (!row) return { ...def, overridden: false, active: true, updatedAt: null };
  return {
    ...def,
    subject: def.channel === "EMAIL" ? (row.subject ?? def.subject) : null,
    body: row.body,
    active: row.active,
    overridden: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Every template, in the order of `TEMPLATE_KEYS`. */
export async function listTemplates(): Promise<ResolvedTemplate[]> {
  const rows = await prisma.messageTemplate.findMany({
    select: { key: true, subject: true, body: true, active: true, updatedAt: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return TEMPLATE_KEYS.map((key) => {
    const def = DEFAULT_TEMPLATES[key];
    const row = byKey.get(key);
    if (!row) return { ...def, overridden: false, active: true, updatedAt: null };
    return {
      ...def,
      subject: def.channel === "EMAIL" ? (row.subject ?? def.subject) : null,
      body: row.body,
      active: row.active,
      overridden: true,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export type RenderedMessage = { subject: string | null; text: string };

/** Renders a template with variables. Returns null when the template is switched off. */
export async function renderTemplate(key: TemplateKey, vars: TemplateVars, db: Db = prisma): Promise<RenderedMessage | null> {
  const t = await getTemplate(key, db);
  if (!t.active) return null;
  const safeVars: TemplateVars = t.audience === "clinica" ? vars : { ...vars, motiv: "" };
  return {
    subject: t.subject ? renderText(t.subject, safeVars).replace(/\s+/g, " ").trim() : null,
    text: renderText(t.body, safeVars),
  };
}

/** Saves an override (ADMIN, `templates.manage`); validates variables and audits `template.update`. */
export async function saveTemplate(
  key: TemplateKey,
  input: { subject?: string | null; body: string; active: boolean },
  actor: CurrentUser,
): Promise<void> {
  const def = DEFAULT_TEMPLATES[key];
  const allowed = allowedVariables(key);
  const fieldErrors: Record<string, string[]> = {};
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (!body) fieldErrors.body = ["Scrieți textul mesajului."];
  else {
    const p = templateProblems(body, allowed);
    if (p.length) fieldErrors.body = p;
  }
  let subject: string | null = null;
  if (def.channel === "EMAIL") {
    subject = (input.subject ?? "").replace(/\s+/g, " ").trim();
    if (!subject) fieldErrors.subject = ["Scrieți subiectul e-mailului."];
    else {
      const p = templateProblems(subject, allowed);
      if (p.length) fieldErrors.subject = p;
    }
  }
  if (Object.keys(fieldErrors).length) throw new DomainError("VALIDATION", undefined, { fieldErrors });

  await prisma.$transaction(async (tx) => {
    await tx.messageTemplate.upsert({
      where: { key },
      create: { key, channel: def.channel, kind: def.kind, name: def.name, subject, body, active: input.active, updatedById: actor.id },
      update: { subject, body, active: input.active, updatedById: actor.id },
    });
    await audit(
      { action: "template.update", entityType: "MessageTemplate", entityId: key, metadata: { key, fields: ["subject", "body", "active"] } },
      { actor, db: tx },
    );
  });
}

/** „Reveniți la textul implicit”: deletes the override and audits. */
export async function resetTemplate(key: TemplateKey, actor: CurrentUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.messageTemplate.deleteMany({ where: { key } });
    await audit(
      { action: "template.update", entityType: "MessageTemplate", entityId: key, metadata: { key, reset: true } },
      { actor, db: tx },
    );
  });
}
