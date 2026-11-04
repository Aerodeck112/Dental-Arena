import type { ServiceContent } from "./types";

export const parodontologie: ServiceContent = {
  slug: "parodontologie",
  title: "Parodontologie",
  seoTitle: "Tratament parodontoză în Cristești și Luduș",
  description:
    "Tratament pentru parodontoză în Cristești și Luduș: igienizare profesională, chiuretaj parodontal și imobilizarea dinților. Prețuri pe site.",
  lead: "Parodontoza, boala gingiilor și a osului din jurul dinților, duce în timp la pierderea dinților. Depistată devreme, se poate trata.",
  summary: "Boala parodontală, depistată devreme, se poate trata înainte să ducă la pierderea dinților.",
  body: [
    "Boala parodontală sau parodontoza este cauzată în principal de placa bacteriană. În timp, dacă este lăsată netratată, duce la pierderea dinților.",
    "Poate fi tratată dacă este depistată devreme, iar acest lucru se face prin igienizare profesională și investigații radiologice. Parodontometria înseamnă măsurarea spațiului dintre gingie și dinte, ca să vedem cât de avansată este boala.",
    "Vă recomandăm să vă programați periodic la o consultație, pentru a evita efectele provocate de parodontoză.",
  ],
  image: {
    src: "/images/clinica/radiografie-tableta.jpg",
    alt: "Medicul îi arată pacientului radiografia pe o tabletă, în cabinet",
    width: 938,
    height: 656,
    caption: "Investigațiile radiologice arată cât de avansată este boala.",
    maxDisplayWidth: 480,
    focus: "60% 40%",
  },
  priceNote: "Prețurile sunt orientative. Costul exact îl aflați după consultație și radiografii.",
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "Ce este parodontoza?", answer: "Este boala gingiilor și a țesuturilor care susțin dinții, cauzată în principal de placa bacteriană. Netratată, duce la pierderea dinților." },
    { question: "Se poate trata parodontoza?", answer: "Da, mai ales dacă este depistată devreme: prin igienizare profesională, chiuretaj parodontal și, la nevoie, imobilizarea dinților." },
    { question: "Care sunt semnele parodontozei?", answer: "Sângerarea gingiilor, retragerea lor și dinții care se mișcă. Dacă le observați, programați o consultație." },
  ],
  ctaTitle: "Programați o consultație",
  bookingCode: "CON-CONSULT",
  comfortNote: true,
  related: ["consultatie-profilaxie", "implantologie"],
};
