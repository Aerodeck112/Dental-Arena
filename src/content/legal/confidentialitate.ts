import { REVIEW_NOTE, type LegalDoc } from "./types";

/** Politica de confidențialitate (GDPR). The site collects health data, so this must be live before booking is. */
export const CONFIDENTIALITATE: LegalDoc = {
  slug: "politica-de-confidentialitate",
  title: "Politica de confidențialitate",
  seoTitle: "Politica de confidențialitate și protecția datelor (GDPR)",
  description:
    "Cum prelucrează Dental Arena datele dumneavoastră personale și datele despre sănătate, cât timp le păstrăm, cui le transmitem și ce drepturi aveți.",
  updated: "2026-10-05",
  reviewNote: REVIEW_NOTE,
  intro:
    "Vă explicăm, pe scurt și pe înțeles, ce date personale prelucrăm când folosiți acest site sau veniți la clinică, de ce, cât timp le păstrăm și ce drepturi aveți. Textul respectă Regulamentul (UE) 2016/679 (GDPR) și legislația română privind protecția datelor.",
  sections: [
    {
      id: "operator",
      title: "Cine prelucrează datele",
      blocks: [
        {
          kind: "p",
          text: "Operatorul datelor este {{legalName}}, cu sediul în {{registeredAddress}}, CUI {{cui}}, nr. de înregistrare la Registrul Comerțului {{regCom}}, denumită în continuare „Dental Arena” sau „clinica”.",
        },
        {
          kind: "ul",
          items: [
            "Punct de lucru Cristești: str. Principală 536J/1, Cristești, județul Mureș, telefon 0265 326 316.",
            "Punct de lucru Luduș: str. Gheorghe Barițiu nr. 6, Luduș, județul Mureș, telefon 0365 430 125.",
            "Pentru orice întrebare despre datele dumneavoastră ne scrieți la {{dpoEmail}}.",
          ],
        },
      ],
    },
    {
      id: "date",
      title: "Ce date prelucrăm",
      blocks: [
        { kind: "p", text: "Prelucrăm doar datele de care avem nevoie pentru scopul respectiv:" },
        {
          kind: "ul",
          items: [
            "Formularul de contact: numele, adresa de e-mail și/sau numărul de telefon, clinica despre care ne scrieți și mesajul.",
            "Programarea online: numele, telefonul, adresa de e-mail (opțional), motivul vizitei, clinica, medicul și ora alese, răspunsul la întrebarea „Cum vă simțiți înainte de vizită?”, dorința de a lucra sub inhalosedare, ce ne scrieți despre ce vă îngrijorează și, dacă programarea este pentru un copil, prenumele și vârsta lui.",
            "Cererea „Prefer să mă sunați”: numele, telefonul și intervalul în care preferați să vă sunăm.",
            "La clinică, ca pacient: datele de identificare (inclusiv CNP-ul, păstrat criptat), datele de contact, istoricul medical (anamneza), fișa dentară, planurile de tratament, radiografiile și documentele medicale, consimțămintele, facturile și plățile.",
            "Date tehnice: o amprentă criptată (hash) a adresei IP, folosită doar pentru protecția formularelor împotriva abuzurilor și ca dovadă a acordului dat online. Adresa IP în clar nu o păstrăm.",
          ],
        },
      ],
    },
    {
      id: "sanatate",
      title: "Datele despre sănătate",
      blocks: [
        {
          kind: "p",
          text: "Datele despre sănătate sunt o categorie specială de date (art. 9 GDPR). Le prelucrăm pentru diagnostic și tratament, de către personal medical obligat la secretul profesional (art. 9 alin. (2) lit. h GDPR). Pentru informațiile pe care ni le trimiteți online înainte de vizită, de exemplu motivul vizitei sau faptul că vă e teamă de dentist, vă cerem acordul explicit (art. 9 alin. (2) lit. a GDPR), prin bifa din formular.",
        },
        {
          kind: "p",
          text: "Personalul de la recepție vede doar ce îi trebuie pentru programare și pentru siguranța dumneavoastră, de exemplu o alergie. Istoricul medical complet și fișa dentară le văd doar medicii.",
        },
      ],
    },
    {
      id: "scopuri",
      title: "De ce prelucrăm datele și pe ce temei",
      blocks: [
        {
          kind: "table",
          caption: "Scopurile prelucrării și temeiurile legale",
          head: ["Scop", "Temei legal"],
          rows: [
            ["Programarea consultațiilor și comunicarea despre programare", "Demersuri făcute la cererea dumneavoastră înaintea unui contract (art. 6 alin. (1) lit. b GDPR)"],
            ["Diagnosticul, tratamentul și ținerea evidențelor medicale", "Obligații legale și furnizarea serviciilor medicale (art. 6 alin. (1) lit. b și c, art. 9 alin. (2) lit. h GDPR)"],
            ["Reamintirea programării prin SMS", "Consimțământul dumneavoastră, pe care îl puteți retrage oricând (art. 6 alin. (1) lit. a GDPR)"],
            ["Reamintirea programării prin e-mail și răspunsul la mesaje", "Demersurile făcute la cererea dumneavoastră (art. 6 alin. (1) lit. b GDPR)"],
            ["Facturarea și evidența contabilă", "Obligație legală (art. 6 alin. (1) lit. c GDPR)"],
            ["Protecția formularelor împotriva abuzurilor și securitatea sistemelor", "Interesul nostru legitim (art. 6 alin. (1) lit. f GDPR)"],
          ],
        },
        { kind: "p", text: "Nu folosim datele dumneavoastră pentru publicitate, nu le vindem și nu luăm decizii automate pe baza lor." },
      ],
    },
    {
      id: "pastrare",
      title: "Cât timp păstrăm datele",
      blocks: [
        {
          kind: "ul",
          items: [
            "Cererile trimise din site care nu devin programări (contact, apel invers, programări nefinalizate): cel mult {{leadRetentionDays}} de zile, apoi le anonimizăm.",
            "Textul mesajelor trimise prin SMS și e-mail: {{messageBodyRetentionDays}} de zile; după aceea păstrăm doar faptul că mesajul a fost trimis.",
            "Dosarul medical al pacientului: perioada prevăzută de legislația medicală în vigoare [de completat de consilierul juridic al clinicii].",
            "Facturile și documentele de plată: perioada prevăzută de legislația financiar-contabilă [de confirmat cu contabilul clinicii].",
          ],
        },
      ],
    },
    {
      id: "destinatari",
      title: "Cui transmitem datele",
      blocks: [
        { kind: "p", text: "Datele sunt accesibile doar personalului clinicii care are nevoie de ele, pe roluri (medic, recepție, administrator). Le mai pot primi:" },
        {
          kind: "ul",
          items: [
            "furnizorii care ne ajută să funcționăm, pe bază de contract și doar cât le este necesar: găzduirea site-ului, serviciul de e-mail, serviciul de SMS [de completat: denumirile furnizorilor];",
            "laboratorul de tehnică dentară, pentru lucrările protetice, doar cu datele necesare lucrării;",
            "autoritățile publice, atunci când legea ne obligă;",
            "contabilul clinicii, pentru facturi și plăți.",
          ],
        },
        {
          kind: "p",
          text: "Nu transferăm datele în afara Spațiului Economic European. Dacă un furnizor ar face acest lucru, ne asigurăm că există garanțiile cerute de GDPR [de confirmat în funcție de furnizori].",
        },
      ],
    },
    {
      id: "drepturi",
      title: "Drepturile dumneavoastră",
      blocks: [
        {
          kind: "ul",
          items: [
            "dreptul de a afla ce date avem despre dumneavoastră și de a primi o copie a lor;",
            "dreptul de a cere corectarea datelor greșite sau incomplete;",
            "dreptul de a cere ștergerea datelor, cu excepția celor pe care legea ne obligă să le păstrăm (de exemplu dosarul medical și facturile);",
            "dreptul de a cere restricționarea prelucrării și dreptul de a vă opune prelucrării bazate pe interesul nostru legitim;",
            "dreptul de a primi datele într-un format structurat, pentru a le transmite altui operator;",
            "dreptul de a vă retrage oricând consimțământul, fără să fie afectată prelucrarea făcută până atunci;",
            "dreptul de a depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (www.dataprotection.ro).",
          ],
        },
        {
          kind: "p",
          text: "Pentru oricare dintre aceste drepturi ne scrieți la {{dpoEmail}} sau ne spuneți la recepție. Vă răspundem în cel mult o lună.",
        },
      ],
    },
    {
      id: "securitate",
      title: "Cum protejăm datele",
      blocks: [
        {
          kind: "ul",
          items: [
            "site-ul și aplicația clinicii folosesc doar conexiuni criptate;",
            "CNP-ul se păstrează criptat și se afișează mascat; dezvăluirea lui se înregistrează;",
            "fiecare membru al echipei are cont propriu, cu acces doar la ce îi trebuie;",
            "accesările dosarelor și exporturile de date se înregistrează într-un jurnal;",
            "formularele de pe site sunt protejate împotriva trimiterilor automate, fără teste de tip CAPTCHA.",
          ],
        },
      ],
    },
    {
      id: "copii",
      title: "Datele copiilor",
      blocks: [
        {
          kind: "p",
          text: "Programările pentru copii le face părintele sau tutorele, care își dă acordul în numele copilului. Pentru un copil cerem online doar prenumele și vârsta; restul datelor le completăm împreună la clinică.",
        },
      ],
    },
    {
      id: "cookie",
      title: "Cookie-uri",
      blocks: [
        {
          kind: "p",
          text: "Folosim doar cookie-urile necesare funcționării site-ului. Harta Google se încarcă doar după ce o cereți. Detaliile sunt în Politica cookies.",
        },
      ],
    },
    {
      id: "modificari",
      title: "Modificări",
      blocks: [
        {
          kind: "p",
          text: "Când modificăm această politică, publicăm aici noua versiune și data ei. Versiunea textului de acord folosit în formulare este {{consentTextVersion}}.",
        },
      ],
    },
  ],
};
