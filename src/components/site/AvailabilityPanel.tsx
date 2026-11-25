import { getHomeAvailability } from "@/server/public/queries";
import type { ClinicAvailability } from "@/server/public/types";
import { CLINIC_ORDER, CLINICS } from "@/content/site";
import { AvailabilityPanelClient } from "./AvailabilityPanelClient";

/**
 * „Primele ore libere pentru o consultație” (design-system §6.4): three live slots per clinic from
 * the CRM, split on the axis. If the CRM cannot be reached the panel shows both phone numbers.
 */
export async function AvailabilityPanel({ title, fallback, className }: { title: string; fallback: string; className?: string }) {
  let clinics: ClinicAvailability[];
  try {
    clinics = await getHomeAvailability(3);
  } catch {
    clinics = [];
  }
  // Both clinics always appear, in axis order, even when the CRM did not answer for one of them.
  const full: ClinicAvailability[] = CLINIC_ORDER.map(
    (slug) =>
      clinics.find((c) => c.clinic === slug) ?? {
        clinic: slug,
        shortName: CLINICS[slug].shortName,
        phone: CLINICS[slug].phone,
        slots: [],
        allHref: `/programare?clinica=${slug}`,
      },
  );
  return <AvailabilityPanelClient clinics={full} title={title} fallback={fallback} className={className} />;
}
