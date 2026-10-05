import "server-only";
import { cache } from "react";
import { audit } from "./audit";
import type { CurrentUser } from "./auth/dal";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { mergeSettings, SETTINGS_SCHEMAS, type SettingKey, type SettingsMap } from "./settings-schema";

export {
  SETTINGS_DEFAULTS,
  SETTINGS_SCHEMAS,
  SETTING_KEYS,
  SETTING_KEY_LABEL,
  isSettingKey,
  type SettingKey,
  type SettingsMap,
} from "./settings-schema";

/**
 * Clinic settings stored as validated JSON in `Setting` rows (docs/architecture.md §3.2
 * invariant 10, §7.4). Values merge over the code defaults, so a missing row is never an error.
 */

const readSetting = cache(async (key: SettingKey): Promise<unknown> => {
  const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as unknown;
  } catch {
    console.error(`[settings] Valoare JSON invalidă pentru cheia „${key}”; se folosesc valorile implicite.`);
    return null;
  }
});

/** DB value merged over the defaults; cached per request. */
export async function getSettings<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  return mergeSettings(key, await readSetting(key));
}

/** Validates, stores and audits (`settings.update`, field names only). Unknown keys are rejected. */
export async function saveSettings<K extends SettingKey>(
  key: K,
  value: SettingsMap[K],
  actor: CurrentUser,
): Promise<void> {
  const schema = SETTINGS_SCHEMAS[key];
  if (!schema) throw new DomainError("VALIDATION", "Setare necunoscută.");
  const parsed = schema.strict().safeParse(value);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || key;
      (fieldErrors[path] ??= []).push(issue.message);
    }
    throw new DomainError("VALIDATION", undefined, { fieldErrors });
  }
  const json = JSON.stringify(parsed.data);
  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key },
      create: { key, value: json, updatedById: actor.id },
      update: { value: json, updatedById: actor.id },
    });
    await audit(
      { action: "settings.update", entityType: "Setting", entityId: key, metadata: { key, fields: Object.keys(parsed.data) } },
      { actor, db: tx },
    );
  });
}
