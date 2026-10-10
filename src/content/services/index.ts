import { chirurgieDentoAlveolara } from "./chirurgie-dento-alveolara";
import { consultatieProfilaxie } from "./consultatie-profilaxie";
import { esteticaDentara } from "./estetica-dentara";
import { implantologie } from "./implantologie";
import { inhalosedare } from "./inhalosedare";
import { ortodontie } from "./ortodontie";
import { parodontologie } from "./parodontologie";
import { pedodontie } from "./pedodontie";
import { proteticaDentara } from "./protetica-dentara";
import { stomatologieGenerala } from "./stomatologie-generala";
import { SERVICE_SLUGS, type ServiceContent, type ServiceSlug } from "./types";

export { SERVICE_SLUGS, type ServiceContent, type ServiceFaq, type ServiceImage, type ServiceSlug, type ServiceStep } from "./types";

/**
 * The 10 public service pages, at their current WordPress URLs (design-system §6.2), in the
 * order of the old menu and of ServiceCategory.sortOrder.
 */
export const SERVICES: Record<ServiceSlug, ServiceContent> = {
  "consultatie-profilaxie": consultatieProfilaxie,
  "stomatologie-generala": stomatologieGenerala,
  inhalosedare,
  implantologie,
  "chirurgie-dento-alveolara": chirurgieDentoAlveolara,
  "protetica-dentara": proteticaDentara,
  pedodontie,
  ortodontie,
  parodontologie,
  "estetica-dentara": esteticaDentara,
};

export const SERVICE_LIST: readonly ServiceContent[] = SERVICE_SLUGS.map((s) => SERVICES[s]);

export function isServiceSlug(v: string): v is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(v);
}

export function getServiceContent(slug: string): ServiceContent | null {
  return isServiceSlug(slug) ? SERVICES[slug] : null;
}

/** Services that show „Cum decurge” (the thread): only real sequences (design-system §6.5). */
export const SERVICES_WITH_STEPS: readonly ServiceSlug[] = SERVICE_SLUGS.filter((s) => !!SERVICES[s].steps?.length);
