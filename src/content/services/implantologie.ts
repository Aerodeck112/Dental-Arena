import type { ServiceContent } from "./types";

export const implantologie: ServiceContent = {
  slug: "implantologie",
  title: "Implantologie",
  seoTitle: "Implant dentar și coroane pe implant în Cristești și Luduș",
  description:
    "Implant dentar din titan, bont protetic și coroane pe implant la Dental Arena Cristești și Luduș. Planul se face după radiografii, iar vindecarea durează 3–6 luni.",
  lead: "Dinții lipsă se pot înlocui cu un implant: o piesă din titan care ține locul rădăcinii.",
  summary: "Medici pregătiți pentru cele mai complexe cazuri de implantologie și chirurgie dentară.",
  body: [
    "Lipsa dinților creează neplăceri atât din punct de vedere funcțional, cât și estetic. Însă dinții se pot înlocui prin implant dentar.",
    "După ce extracția este vindecată sau imediat după extracție, se inserează o piesă din titan de forma unui șurub, ca înlocuitor pentru rădăcină. Perioada de vindecare este de 3–6 luni, după care se atașează un bont protetic (piesa care leagă implantul de dinte), deasupra căruia medicul plasează coroana, puntea sau proteza.",
    "Totul se face cu precizie, după analiza unui set de radiografii speciale.",
  ],
  steps: [
    { label: "Radiografii și planul de tratament" },
    { label: "Inserarea implantului" },
    { label: "Vindecare, 3–6 luni" },
    { label: "Bontul protetic" },
    { label: "Coroana, puntea sau proteza" },
  ],
  image: {
    src: "/images/clinica/perete-muschi.jpg",
    alt: "Peretele de mușchi viu din clinică, cu sigla Dental Arena: un dinte așezat pe un implant",
    width: 1500,
    height: 2000,
    caption: "Sigla noastră este chiar un implant, pe peretele de mușchi din clinică.",
    focus: "50% 45%",
  },
  priceNote: "Prețurile sunt orientative. Costul exact îl aflați după consultație și radiografii.",
  faqs: [],
  ctaTitle: "Programați o consultație de implantologie",
  bookingCode: "IMP-CONSULT",
  comfortNote: true,
  related: ["chirurgie-dento-alveolara", "protetica-dentara"],
};
