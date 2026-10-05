import { REVIEW_NOTE, type LegalDoc } from "./types";

/** Name, max age and purpose of the consent cookie (architecture §8.4). */
export const CONSENT_COOKIE = "da_consent";
export const CONSENT_MAX_AGE_DAYS = 180;

/** Politica cookies: necessary cookies only, Google Maps after consent, no analytics (§8.4). */
export const COOKIES: LegalDoc = {
  slug: "politica-cookies",
  title: "Politica cookies",
  seoTitle: "Politica cookies",
  description:
    "Ce cookie-uri folosește site-ul Dental Arena: doar cele necesare, plus harta Google numai după ce o cereți. Fără cookie-uri de analiză sau de publicitate.",
  updated: "2026-10-05",
  reviewNote: REVIEW_NOTE,
  intro:
    "Cookie-urile sunt fișiere mici pe care un site le păstrează în browserul dumneavoastră. Folosim cât mai puține: doar pe cele fără de care site-ul nu funcționează. Nu folosim cookie-uri de analiză sau de publicitate.",
  sections: [
    {
      id: "lista",
      title: "Ce cookie-uri folosim",
      blocks: [
        {
          kind: "table",
          caption: "Cookie-urile site-ului Dental Arena",
          head: ["Nume", "Tip", "Pentru ce", "Cât timp"],
          rows: [
            [CONSENT_COOKIE, "Necesar", "Ține minte alegerea dumneavoastră despre cookie-uri și hărți.", `${CONSENT_MAX_AGE_DAYS} de zile`],
            ["da_session", "Necesar", "Doar pentru personalul clinicii: păstrează sesiunea de lucru în aplicația internă.", "cel mult 12 ore"],
            ["da_clinica", "Preferință", "Doar pentru personalul clinicii: clinica aleasă în aplicația internă.", "1 an"],
          ],
        },
      ],
    },
    {
      id: "harti",
      title: "Harta Google",
      blocks: [
        {
          kind: "p",
          text: "Pe pagina de contact puteți afișa harta Google a fiecărei clinici. Harta se încarcă doar după ce apăsați „Afișați harta” sau după ce acceptați hărțile în setările cookie-urilor. Abia atunci Google poate seta propriile cookie-uri, conform politicii Google (policies.google.com). Fără acord, vă oferim doar linkul „Deschideți în Google Maps”.",
        },
      ],
    },
    {
      id: "stocare",
      title: "Alte informații păstrate în browser",
      blocks: [
        { kind: "p", text: "Pe lângă cookie-uri, site-ul păstrează în browser, doar pe dispozitivul dumneavoastră:" },
        {
          kind: "ul",
          items: [
            "răspunsul la întrebarea „Cum vă simțiți când vă gândiți la dentist?”, ca să nu-l completați de două ori la programare (se șterge când închideți fila);",
            "datele din formularul de programare, cât timp îl completați (se șterg când închideți fila);",
            "ultima clinică aleasă în panoul cu orele libere de pe prima pagină;",
            "pentru personalul clinicii, tema aleasă în aplicația internă (luminoasă sau întunecată).",
          ],
        },
        { kind: "p", text: "Aceste informații nu ne sunt trimise și nu vă identifică." },
      ],
    },
    {
      id: "control",
      title: "Cum vă schimbați alegerea",
      blocks: [
        {
          kind: "p",
          text: "Oricând, din linkul „Setări cookie-uri” din subsolul paginii sau din butonul de mai jos. Puteți șterge cookie-urile și din setările browserului; site-ul vă va întreba din nou.",
        },
      ],
    },
  ],
};
