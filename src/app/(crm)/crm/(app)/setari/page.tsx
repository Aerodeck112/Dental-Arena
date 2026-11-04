import type { Metadata } from "next";
import { SettingsForms } from "@/components/crm/admin/SettingsForms";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { getSettings, SETTING_KEY_LABEL, SETTING_KEYS } from "@/lib/settings";

export const metadata: Metadata = { title: "Setări" };

/** Setări (ADMIN): clinic data, online booking rules, reminders, invoicing series, GDPR retention, density. */
export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [clinic, booking, reminders, invoicing, gdpr, ui, services] = await Promise.all([
    getSettings("clinic"),
    getSettings("booking"),
    getSettings("reminders"),
    getSettings("invoicing"),
    getSettings("gdpr"),
    getSettings("ui"),
    prisma.service.findMany({
      where: { active: true, code: { not: null } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: { id: true, code: true, name: true, bookableOnline: true, onlineLabel: true },
    }),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader title="Setări" subtitle="Fiecare grup se salvează separat și rămâne în jurnalul de audit." />
      <nav aria-label="Grupuri de setări" className="flex flex-wrap gap-x-4 gap-y-1 text-corp">
        {SETTING_KEYS.map((k) => (
          <a key={k} href={`#${k}`} className="text-link underline underline-offset-2">
            {SETTING_KEY_LABEL[k]}
          </a>
        ))}
      </nav>
      <SettingsForms
        values={{ clinic, booking, reminders, invoicing, gdpr, ui }}
        services={services.map((s) => ({ code: s.code!, name: s.name }))}
        onlineServices={services.filter((s) => s.bookableOnline).map((s) => ({ id: s.id, name: s.name, onlineLabel: s.onlineLabel }))}
      />
    </div>
  );
}
