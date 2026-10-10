import { REVIEW_NOTE, type LegalDoc } from "./types";

/** Termeni și condiții. The live site had none (research notes item 1); written from scratch. */
export const TERMENI: LegalDoc = {
  slug: "termeni-si-conditii",
  title: "Termeni și condiții",
  seoTitle: "Termeni și condiții de folosire a site-ului",
  description:
    "Condițiile de folosire a site-ului Dental Arena: programările online, prețurile orientative, informațiile medicale, reclamațiile și soluționarea litigiilor.",
  updated: "2026-10-05",
  reviewNote: REVIEW_NOTE,
  intro:
    "Acești termeni se aplică folosirii site-ului Dental Arena și programărilor făcute prin el. Folosind site-ul, sunteți de acord cu ei.",
  sections: [
    {
      id: "operator",
      title: "Despre noi",
      blocks: [
        {
          kind: "p",
          text: "Site-ul este administrat de {{legalName}}, cu sediul în {{registeredAddress}}, CUI {{cui}}, nr. de înregistrare la Registrul Comerțului {{regCom}}, e-mail {{email}}. Clinica are două puncte de lucru: Cristești (str. Principală 536J/1, telefon 0265 326 316) și Luduș (str. Gheorghe Barițiu nr. 6, telefon 0365 430 125).",
        },
      ],
    },
    {
      id: "informatii",
      title: "Informațiile de pe site",
      blocks: [
        {
          kind: "p",
          text: "Informațiile medicale de pe site sunt generale și nu înlocuiesc consultația. Diagnosticul și planul de tratament le stabilește medicul, după examinare și, la nevoie, după radiografii.",
        },
        {
          kind: "p",
          text: "Ne străduim ca informațiile să fie corecte și la zi. Dacă observați o greșeală, ne ajutați dacă ne scrieți.",
        },
      ],
    },
    {
      id: "preturi",
      title: "Prețuri",
      blocks: [
        {
          kind: "p",
          text: "Prețurile afișate sunt în lei și sunt orientative. Ele nu reprezintă o ofertă fermă: costul exact al tratamentului îl stabilim împreună după consultație și îl vedeți în planul de tratament, înainte să începem.",
        },
        {
          kind: "p",
          text: "Serviciile medicale stomatologice sunt scutite de TVA, conform Codului fiscal [de confirmat de contabilul clinicii]. Puteți plăti în numerar, cu cardul sau prin transfer bancar.",
        },
      ],
    },
    {
      id: "programari",
      title: "Programările online",
      blocks: [
        {
          kind: "ul",
          items: [
            "Ora aleasă online vă este rezervată, iar recepția vă sună de la numărul clinicii ca să confirme programarea.",
            "Puteți confirma sau anula programarea din linkul primit prin SMS sau e-mail, cu cel puțin {{cancelCutoffHours}} ore înainte. După acest termen, vă rugăm să sunați la clinică.",
            "Dacă nu mai puteți veni, anunțați-ne cât mai devreme, ca ora să poată fi oferită altui pacient.",
            "Pentru urgențe (durere puternică, umflătură, sângerare) sunați direct la clinică.",
          ],
        },
      ],
    },
    {
      id: "utilizare",
      title: "Folosirea site-ului",
      blocks: [
        {
          kind: "p",
          text: "Vă rugăm să folosiți formularele doar pentru cereri reale și să ne dați date corecte. Ne rezervăm dreptul de a nu da curs cererilor trimise în mod automat sau abuziv.",
        },
        {
          kind: "p",
          text: "Textele, fotografiile și sigla Dental Arena aparțin clinicii. Nu le puteți copia sau folosi fără acordul nostru scris.",
        },
        {
          kind: "p",
          text: "Site-ul poate conține linkuri către alte site-uri (de exemplu Google Maps, Facebook, Instagram), pentru al căror conținut nu răspundem.",
        },
      ],
    },
    {
      id: "date",
      title: "Datele personale",
      blocks: [
        {
          kind: "p",
          text: "Cum prelucrăm datele dumneavoastră aflați din Politica de confidențialitate, iar ce cookie-uri folosim, din Politica cookies.",
        },
      ],
    },
    {
      id: "reclamatii",
      title: "Reclamații și soluționarea litigiilor",
      blocks: [
        {
          kind: "p",
          text: "Dacă nu sunteți mulțumit de ceva, spuneți-ne la recepție, la telefon sau la {{email}}. Vă răspundem în cel mult 30 de zile.",
        },
        {
          kind: "p",
          text: "Puteți apela și la soluționarea alternativă a litigiilor (SAL), prin Autoritatea Națională pentru Protecția Consumatorilor (anpc.ro), sau vă puteți adresa instanțelor competente din România.",
        },
      ],
    },
    {
      id: "lege",
      title: "Legea aplicabilă și modificări",
      blocks: [
        { kind: "p", text: "Acești termeni sunt guvernați de legea română." },
        { kind: "p", text: "Putem actualiza termenii; versiunea în vigoare este cea publicată pe această pagină, cu data ei." },
      ],
    },
  ],
};
