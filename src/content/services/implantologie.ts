import type { ServiceContent } from "./types";

export const implantologie: ServiceContent = {
  slug: "implantologie",
  title: "Implantologie",
  seoTitle: "Implant dentar în Cristești și Luduș, lângă Tg. Mureș",
  description:
    "Implant dentar din titan și coroane pe implant în Cristești și Luduș, lângă Târgu Mureș. Plan după radiografii, prețuri afișate. Programați o consultație.",
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
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "Cât durează tratamentul cu implant dentar?", answer: "După inserarea implantului urmează o perioadă de vindecare de 3–6 luni. Apoi se atașează bontul protetic, iar medicul fixează coroana, puntea sau proteza." },
    { question: "Se poate pune implantul imediat după extracție?", answer: "Da, în unele cazuri implantul se inserează imediat după extracție. Medicul decide după analiza radiografiilor speciale, la consultație." },
    { question: "Cât costă un implant dentar?", answer: "Prețurile pentru implant, bont protetic, adiție de os și lucrările pe implant sunt în lista de pe această pagină. Costul exact îl aflați după consultație și radiografii." },
    { question: "Doare inserarea unui implant?", answer: "Intervenția se face sub anestezie locală. Dacă vă e teamă, se poate face și sub inhalosedare: rămâneți conștient, dar mult mai relaxat." },
  ],
  ctaTitle: "Programați o consultație de implantologie",
  bookingCode: "IMP-CONSULT",
  comfortNote: true,
  related: ["chirurgie-dento-alveolara", "protetica-dentara"],
};
