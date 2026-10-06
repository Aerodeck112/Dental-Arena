import "server-only";
import { prisma, type Db } from "@/lib/db";
import { getSettings, type SettingsMap } from "@/lib/settings";

/**
 * Daily maintenance (docs/architecture.md §8.2, §8.4), run by `/api/cron/maintenance`:
 * - purges expired rate-limit buckets;
 * - anonymises unconverted leads older than `gdpr.leadRetentionDays`;
 * - redacts message bodies older than `gdpr.messageBodyRetentionDays`.
 * Every step is idempotent.
 */

export const ANONYMIZED_LEAD_NAME = "Cerere anonimizată";
export const REDACTED_MESSAGE_BODY = "[Text șters după perioada de păstrare]";

const DAY_MS = 24 * 60 * 60 * 1000;

export type MaintenanceResult = {
  now: string;
  rateLimitBucketsPurged: number;
  leadsAnonymized: number;
  messageBodiesRedacted: number;
};

/**
 * Stale = not converted (no patient, no `convertedAt`) and either PIERDUT, or NOU / CONTACTAT and
 * untouched (`updatedAt`) for longer than the retention period.
 */
function staleLeadWhere(cutoff: Date) {
  return {
    name: { not: ANONYMIZED_LEAD_NAME },
    patientId: null,
    convertedAt: null,
    status: { in: ["PIERDUT", "NOU", "CONTACTAT"] as ("PIERDUT" | "NOU" | "CONTACTAT")[] },
    updatedAt: { lt: cutoff },
  };
}

export async function runMaintenance(
  now: Date = new Date(),
  o: { gdpr?: SettingsMap["gdpr"]; db?: Db } = {},
): Promise<MaintenanceResult> {
  const db = o.db ?? prisma;
  const gdpr = o.gdpr ?? (await getSettings("gdpr"));

  const purged = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });

  const leadCutoff = new Date(now.getTime() - gdpr.leadRetentionDays * DAY_MS);
  const stale = await db.lead.findMany({ where: staleLeadWhere(leadCutoff), select: { id: true } });
  const leadIds = stale.map((l) => l.id);
  if (leadIds.length > 0) {
    await db.lead.updateMany({
      where: { id: { in: leadIds } },
      data: {
        name: ANONYMIZED_LEAD_NAME,
        phone: null,
        email: null,
        message: null,
        comfortNote: null,
        childFirstName: null,
        preferredTime: null,
        ipHash: null,
      },
    });
    await db.leadActivity.updateMany({ where: { leadId: { in: leadIds } }, data: { body: null } });
    await db.messageLog.updateMany({
      where: { leadId: { in: leadIds }, patientId: null },
      data: { body: REDACTED_MESSAGE_BODY, subject: null },
    });
  }

  const messageCutoff = new Date(now.getTime() - gdpr.messageBodyRetentionDays * DAY_MS);
  const redacted = await db.messageLog.updateMany({
    where: { createdAt: { lt: messageCutoff }, body: { not: REDACTED_MESSAGE_BODY } },
    data: { body: REDACTED_MESSAGE_BODY, subject: null },
  });

  return {
    now: now.toISOString(),
    rateLimitBucketsPurged: purged.count,
    leadsAnonymized: leadIds.length,
    messageBodiesRedacted: redacted.count,
  };
}
