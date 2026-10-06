"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { saveSettings, SETTING_KEY_LABEL } from "@/lib/settings";
import { SETTINGS_FORM_SCHEMAS } from "@/components/crm/admin/settings-schemas";

/**
 * Setări (docs/architecture.md §7.4): one action per settings key, ADMIN only
 * (`settings.manage`). Each form is zod-validated here and again, strictly, by `saveSettings`,
 * which also writes the `settings.update` audit row. Clinic data and booking rules show on the
 * public site, so every save revalidates it.
 */

function revalidateSettings() {
  revalidatePath("/crm/setari");
  revalidatePath("/", "layout");
}

const ok = (key: keyof typeof SETTING_KEY_LABEL) => `${SETTING_KEY_LABEL[key]}: modificările au fost salvate.`;

export const saveClinicSettingsAction = crmAction(
  { permission: "settings.manage", schema: SETTINGS_FORM_SCHEMAS.clinic, successMessage: ok("clinic") },
  async (value, { user }) => {
    await saveSettings("clinic", value, user);
    revalidateSettings();
    return null;
  },
);

export const saveBookingSettingsAction = crmAction(
  { permission: "settings.manage", schema: SETTINGS_FORM_SCHEMAS.booking, successMessage: ok("booking") },
  async (value, { user }) => {
    await saveSettings("booking", value, user);
    revalidateSettings();
    return null;
  },
);

export const saveRemindersSettingsAction = crmAction(
  { permission: "settings.manage", schema: SETTINGS_FORM_SCHEMAS.reminders, successMessage: ok("reminders") },
  async (value, { user }) => {
    await saveSettings("reminders", value, user);
    revalidateSettings();
    return null;
  },
);

export const saveInvoicingSettingsAction = crmAction(
  { permission: "settings.manage", schema: SETTINGS_FORM_SCHEMAS.invoicing, successMessage: ok("invoicing") },
  async (value, { user }) => {
    await saveSettings("invoicing", value, user);
    revalidateSettings();
    revalidatePath("/crm/facturi", "layout");
    return null;
  },
);

export const saveGdprSettingsAction = crmAction(
  { permission: "settings.manage", schema: SETTINGS_FORM_SCHEMAS.gdpr, successMessage: ok("gdpr") },
  async (value, { user }) => {
    await saveSettings("gdpr", value, user);
    revalidateSettings();
    return null;
  },
);

export const saveUiSettingsAction = crmAction(
  { permission: "settings.manage", schema: SETTINGS_FORM_SCHEMAS.ui, successMessage: ok("ui") },
  async (value, { user }) => {
    await saveSettings("ui", value, user);
    revalidateSettings();
    return null;
  },
);
