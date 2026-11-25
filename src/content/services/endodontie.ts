import type { ServiceContent } from "./types";

/** October 2026: the root-canal part of the former „Stomatologie generală”. */
export const endodontie: ServiceContent = {
  slug: "endodontie",
  title: "Endodonție",
  seoTitle: "Tratament de canal în Cristești și Luduș",
  description:
    "Tratament de canal cu instrumente rotative și retratamente în Cristești, lângă Târgu Mureș, și în Luduș. Fără durere, cu prețuri afișate pe site.",
  lead: "Tratamentul de canal salvează dintele atunci când nervul este inflamat sau infectat.",
  summary: "Tratamentul de canal, cu instrumente rotative, ca să păstrăm dintele: când nervul este inflamat sau infectat.",
  body: [
    "Pulpa dentară (nervul dintelui) se poate inflama sau infecta, de obicei din cauza unei carii profunde, a unor obturații (plombe) întinse, a fisurilor în smalț sau a unor traumatisme. În acest caz, specialiștii noștri recomandă tratamentul de canal, ale cărui etape le urmărim cu strictețe.",
    "Tratamentele de canal le facem cu instrumente rotative, cu cea mai mare precizie, datorită tehnologiei din cabinet. Când un tratament mai vechi nu a reușit, facem retratamentul canalelor.",
    "Dacă vă doare un dinte, sunați-ne: un pansament calmant oprește durerea până la tratamentul complet.",
  ],
  priceNote: "Prețurile sunt orientative. Costul exact îl aflați după consultație și radiografie.",
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "Când este nevoie de tratament de canal?", answer: "Când nervul dintelui (pulpa dentară) se inflamează sau se infectează, de obicei din cauza unei carii profunde, a unor plombe întinse, a fisurilor în smalț sau a unui traumatism." },
    { question: "Doare tratamentul de canal?", answer: "Nu: se face cu anestezie locală. Dacă vă e teamă, spuneți-ne și medicul vă explică fiecare pas." },
    { question: "Ce este retratamentul?", answer: "Refacerea unui tratament de canal mai vechi care nu a reușit: canalele se curăță și se obturează din nou." },
  ],
  ctaTitle: "Programați o consultație",
  bookingCode: "CON-CONSULT",
  comfortNote: true,
  related: ["odontologie", "protetica-dentara"],
};
