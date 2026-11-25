import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

/**
 * E-mail transport (docs/architecture.md §9.1).
 * - With `SMTP_HOST`: nodemailer over SMTP (`secure` on port 465).
 * - Without it: a console transport. In development and tests it prints a framed message; in
 *   production it prints nothing (no personal data in logs) and the caller logs `SIMULAT`.
 */

export type MailInput = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type MailResult = { provider: "smtp" | "console"; messageId?: string };

let transporter: Transporter | null = null;

function smtpTransport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
  });
  return transporter;
}

/** True when real e-mail goes out; false means console (dev) or simulated (production). */
export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

function printToConsole(m: MailInput): void {
  if (env.NODE_ENV === "production") return;
  const rule = "─".repeat(64);
  console.info(
    [
      `┌${rule}`,
      `│ E-mail (consolă, SMTP_HOST nu este setat)`,
      `│ De la:    ${env.MAIL_FROM}`,
      `│ Către:    ${m.to}`,
      m.replyTo ? `│ Răspuns:  ${m.replyTo}` : null,
      `│ Subiect:  ${m.subject}`,
      `├${rule}`,
      ...m.text.split("\n").map((l) => `│ ${l}`),
      `└${rule}`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  );
}

/** Sends one e-mail. Throws when the SMTP server refuses it, so the caller can log `EROARE`. */
export async function sendMail(m: MailInput): Promise<MailResult> {
  if (!isSmtpConfigured()) {
    printToConsole(m);
    return { provider: "console" };
  }
  const info = await smtpTransport().sendMail({
    from: env.MAIL_FROM,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
    replyTo: m.replyTo,
  });
  return { provider: "smtp", messageId: typeof info.messageId === "string" ? info.messageId : undefined };
}
