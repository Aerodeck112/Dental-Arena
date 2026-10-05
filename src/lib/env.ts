import { z } from "zod";

/**
 * Environment variables, validated once at import (docs/architecture.md §1 and §7.2).
 * Server code only: never import this file from a client component.
 */

/** Development-only values shipped in `.env.example`. Production logs a loud warning for them. */
const PLACEHOLDER_SECRETS = new Set([
  "schimba-acest-secret-cu-unul-lung-si-aleator-000000",
  "AP+cmG7JW7BMoeLeolh6r2gfLeQQ8Oaf29Uo+fbhYh8=",
  "schimba-si-acest-secret",
]);

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const withDefault = (value: string) => z.preprocess(emptyToUndefined, z.string().trim().default(value));

const schema = z.object({
  NODE_ENV: z.preprocess(emptyToUndefined, z.enum(["development", "test", "production"]).default("development")),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL lipsește."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET trebuie să aibă cel puțin 32 de caractere."),
  PII_ENCRYPTION_KEY: z
    .string()
    .trim()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "PII_ENCRYPTION_KEY trebuie să fie exact 32 de octeți codați base64.",
    }),
  APP_URL: z
    .string()
    .trim()
    .url("APP_URL trebuie să fie o adresă completă, de exemplu https://dentalarena.ro.")
    .transform((v) => v.replace(/\/+$/, "")),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(587)),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: withDefault("Dental Arena <office@dentalarena.ro>"),
  CLINIC_NOTIFY_EMAIL: z.string().trim().email("CLINIC_NOTIFY_EMAIL trebuie să fie o adresă de e-mail."),
  SMS_PROVIDER: withDefault("console"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET trebuie să aibă cel puțin 16 caractere."),
  STORAGE_DIR: withDefault("./storage"),
  EINVOICE_PROVIDER: withDefault("none"),
});

export type Env = {
  DATABASE_URL: string;
  AUTH_SECRET: string;
  PII_ENCRYPTION_KEY: string;
  APP_URL: string;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM: string;
  CLINIC_NOTIFY_EMAIL: string;
  SMS_PROVIDER: string;
  CRON_SECRET: string;
  STORAGE_DIR: string;
  EINVOICE_PROVIDER: string;
  NODE_ENV: "development" | "test" | "production";
};

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new Error(
      `Configurația din .env nu este validă:\n${lines.join("\n")}\nVedeți .env.example pentru valori de exemplu.`,
    );
  }
  const value = parsed.data;
  if (value.NODE_ENV === "production") {
    const weak = (["AUTH_SECRET", "PII_ENCRYPTION_KEY", "CRON_SECRET"] as const).filter((k) =>
      PLACEHOLDER_SECRETS.has(value[k]),
    );
    if (weak.length > 0) {
      console.warn(
        `[env] ATENȚIE: ${weak.join(", ")} folosesc valorile demonstrative din .env.example. Înlocuiți-le înainte de lansare.`,
      );
    }
  }
  return value;
}

export const env: Env = loadEnv();

/** True when the app runs in production mode (`next start` or a production build). */
export const isProduction = env.NODE_ENV === "production";
