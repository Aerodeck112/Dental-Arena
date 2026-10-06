/**
 * The photo places of the public site that can be changed from the CRM (Fotografii site). Each
 * place has a default photo from the current site; an uploaded photo replaces it until it is
 * reset. Doctor portraits are changed on the doctor's profile (Echipă), not here.
 */

export type SiteImageDefault = { src: string; width: number; height: number; alt: string };

export type SiteImageSlot = {
  key: string;
  group: "Acasă" | "Clinicile" | "Despre noi" | "Servicii";
  label: string;
  /** Where it shows and what kind of photo fits. */
  hint: string;
  default: SiteImageDefault;
};

const IMG = {
  muschi: { src: "/images/clinica/perete-muschi.jpg", width: 1500, height: 2000, alt: "Peretele de mușchi viu din clinică, cu sigla Dental Arena" },
  receptie: { src: "/images/clinica/receptie.jpg", width: 1430, height: 953, alt: "La recepția Dental Arena, asistenta îi dă unui pacient documentele vizitei" },
  receptieLarg: { src: "/images/clinica/receptie-larg.jpg", width: 1430, height: 953, alt: "Recepția și sala de așteptare a clinicii Dental Arena" },
  asteptare: { src: "/images/clinica/sala-asteptare.jpg", width: 1500, height: 2000, alt: "Sala de așteptare, cu canapeaua galbenă și un tablou colorat" },
  canapea: { src: "/images/clinica/floare-canapea.jpg", width: 1430, height: 953, alt: "O gerberă galbenă în fața canapelei din sala de așteptare" },
  plaja: { src: "/images/clinica/cabinet-plaja.jpg", width: 1500, height: 2000, alt: "Cabinetul cu o plajă pictată pe perete, pentru copii" },
  radiografie: { src: "/images/clinica/radiografie-tableta.jpg", width: 938, height: 656, alt: "Medicul îi arată pacientului radiografia pe o tabletă" },
  cristesti: { src: "/images/clinica/cristesti-fatada.jpg", width: 2000, height: 1334, alt: "Fațada clinicii Dental Arena din Cristești" },
  ludusSeara: { src: "/images/clinica/ludus-seara.jpg", width: 1440, height: 1800, alt: "Clinica Dental Arena din Luduș, seara" },
} satisfies Record<string, SiteImageDefault>;

const service = (slug: string, name: string, d: SiteImageDefault): SiteImageSlot => ({
  key: `serviciu.${slug}`,
  group: "Servicii",
  label: name,
  hint: `Fotografia mare din pagina „${name}”. Merge bine o fotografie orizontală din cabinet.`,
  default: d,
});

export const SITE_IMAGE_SLOTS: readonly SiteImageSlot[] = [
  { key: "acasa.principala", group: "Acasă", label: "Fotografia principală", hint: "Prima fotografie de pe site, mare, lângă titlu. Merge bine o fotografie verticală.", default: IMG.muschi },
  { key: "acasa.secundara", group: "Acasă", label: "Fotografia mică de lângă titlu", hint: "Se suprapune peste colțul fotografiei principale. Merge bine o fotografie cu oameni.", default: IMG.receptie },
  { key: "acasa.confort", group: "Acasă", label: "Secțiunea „Fără frică”", hint: "Lângă întrebarea „Cum vă simțiți când vă gândiți la dentist?”. Fotografie verticală.", default: IMG.asteptare },
  { key: "acasa.copii", group: "Acasă", label: "Secțiunea pentru copii", hint: "Fotografie verticală din cabinetul pentru copii.", default: IMG.plaja },
  { key: "acasa.tehnologie", group: "Acasă", label: "Secțiunea „Cum decurge prima vizită”", hint: "Un medic cu un pacient, de preferat orizontală.", default: IMG.radiografie },
  { key: "clinica.cristesti", group: "Clinicile", label: "Clinica din Cristești", hint: "Fațada sau interiorul clinicii din Cristești.", default: IMG.cristesti },
  { key: "clinica.ludus", group: "Clinicile", label: "Clinica din Luduș", hint: "Fațada sau interiorul clinicii din Luduș.", default: IMG.ludusSeara },
  { key: "despre.principala", group: "Despre noi", label: "Fotografia principală", hint: "Prima fotografie din pagina „Despre noi”. Orizontală.", default: IMG.receptieLarg },
  { key: "despre.secundara", group: "Despre noi", label: "A doua fotografie", hint: "O fotografie de atmosferă. Orizontală.", default: IMG.canapea },
  service("consultatie-profilaxie", "Consultație și profilaxie", IMG.radiografie),
  service("stomatologie-generala", "Stomatologie generală", IMG.receptie),
  service("inhalosedare", "Inhalosedare", IMG.asteptare),
  service("implantologie", "Implantologie", IMG.muschi),
  service("chirurgie-dento-alveolara", "Chirurgie dento-alveolară", IMG.radiografie),
  service("protetica-dentara", "Protetică dentară", IMG.receptieLarg),
  service("pedodontie", "Pedodonție", IMG.plaja),
  service("ortodontie", "Ortodonție", IMG.canapea),
  service("parodontologie", "Parodontologie", IMG.radiografie),
  service("estetica-dentara", "Estetică dentară", IMG.canapea),
];

export function siteImageSlot(key: string): SiteImageSlot | undefined {
  return SITE_IMAGE_SLOTS.find((s) => s.key === key);
}
