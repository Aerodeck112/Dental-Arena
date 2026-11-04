/**
 * The audit of the two versions (Next.js, the first; PHP for cPanel, now) as a PDF:
 * node docs/audit/audit.mjs → docs/audit/Audit-versiuni.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const fonts = fs.readFileSync(path.join(root, "php/.build/fonts.css"), "utf8").replace(/url\(\/assets\/fonts\//g, `url(${pathToFileURL(path.join(root, "php/public/assets/fonts")).href}/`);

const DA = '<span class="da">✓</span>';
const NU = '<span class="nu">✗</span>';
const PA = '<span class="pa">◐</span>';
const ZONE = [
  ["Programarea online pe site", [
    ["Pacientul alege o oră liberă reală", `${DA} asistent în 4 pași: motiv și clinică → zi și oră (cu filtru pe medic) → cum se simte → datele lui`, `${NU} doar cerere: alege ziua și un interval („dimineața”), apoi îl sună recepția`, "6a"],
    ["Orele libere: program, pauze, concedii, închideri, durata serviciului, timp de anunț, orizont, pas", `${DA} toate`, `${PA} doar în chatul AI: program pe zile, sărbători legale; fără pauze, concedii, durate pe serviciu`, "6a"],
    ["Programarea apare direct în calendar", `${DA} programare + cerere legată`, `${NU} (doar din chat, în modul „direct”)`, "6a"],
    ["„Nu găsesc o oră, sunați-mă”", `${DA}`, `${PA} formularul de cerere`, "6a"],
    ["Ecran de confirmare cu „Adăugați în calendar” (.ics), hartă, „Ce să aveți la dumneavoastră”", `${DA}`, `${NU}`, "6a"],
    ["Servicii programabile online (durată, etichetă, explicație, „urgent”)", `${DA} pe fiecare serviciu`, `${NU}`, "6a"],
    ["Setări programare online (pornit, pas, anunț minim, câte zile, pauză între programări)", `${DA}`, `${PA} doar pentru chat`, "6a"],
    ["Anti-spam: câmp ascuns, timp, limite pe IP și pe telefon, fără dubluri la dublu-clic", `${DA}`, `${PA} câmp ascuns + limită pe IP`, "6a"],
    ["„Primele ore libere” pe prima pagină și „Prima oră liberă” la fiecare clinică", `${DA}`, `${NU}`, "6b"],
  ]],
  ["Linkul pacientului /p/…", [
    ["Pagina programării (fără date medicale)", `${DA}`, `${NU}`, "6a"],
    ["Confirm / Anulez (până cu N ore înainte), anunț la clinică", `${DA}`, `${NU}`, "6a"],
    ["Fișier calendar .ics", `${DA}`, `${NU}`, "6a"],
    ["Linkul în SMS/e-mail; nu mai merge după mutare sau anulare", `${DA}`, `${NU}`, "6a"],
  ]],
  ["Programul medicilor și zilele libere", [
    ["Program săptămânal pe clinică", `${DA} mai multe intervale pe zi, cabinet, valabil de la–până la`, `${PA} un interval pe zi la fiecare clinică`, "6a"],
    ["Pauze în program", `${DA}`, `${NU}`, "6a"],
    ["Medicul primește / nu primește programări online", `${DA}`, `${NU}`, "6a"],
    ["Concedii, formări, blocaje ale medicilor (zile întregi sau ore)", `${DA} pagina Absențe`, `${NU}`, "6a"],
    ["Zile libere ale clinicii (închidere)", `${DA}`, `${NU}`, "6a"],
    ["Sărbătorile legale", `${PA} introduse de mână`, `${DA} automat (inclusiv Paște și Rusalii ortodoxe), doar în chat`, "6a: peste tot"],
    ["Programările afectate de un concediu nou sunt arătate", `${DA}`, `${NU}`, "6a"],
    ["Programul clinicii pe ore (taie programul medicilor)", `${DA}`, `${PA} doar text afișat pe site`, "6b"],
    ["Cabinete și unități de inhalosedare (conflicte)", `${DA}`, `${NU}`, "6b"],
  ]],
  ["Calendarul și programările din panou", [
    ["Vedere zi pe medici, săptămână, listă", `${DA} + coloane pe cabinete`, `${PA} zi și săptămână`, "6b"],
    ["Mutare și redimensionare prin tragere, cu „Anulați” 6 secunde", `${DA}`, `${NU} (se mută din formular)`, "6b"],
    ["Umbrire pentru pauze și concedii, linia orei curente", `${DA}`, `${NU}`, "6b"],
    ["Conflicte: medic ocupat (blochează)", `${DA}`, `${DA}`, "—"],
    ["Conflicte: concediu/închidere (blochează); în afara programului, pacient suprapus, inhalosedare ocupată, în trecut (avertizează, „Salvați oricum”)", `${DA}`, `${NU}`, "6a / 6b"],
    ["Stările programării cu revenire (de ex. anulat → programat)", `${DA}`, `${PA} se schimbă din formular`, "6b"],
    ["Rechemare automată la finalizare, după serviciu", `${DA}`, `${PA} propusă, se pune de mână`, "6b"],
  ]],
  ["Cererile (leads)", [
    ["Stări și note", `${DA} Nou, Contactat, Programat, Pierdut (cu motiv)`, `${DA} Nouă, În lucru, Programat, Închisă`, "—"],
    ["Atribuire la o persoană, jurnal de activități (apel, SMS, notă)", `${DA}`, `${NU}`, "6b"],
    ["Tablou pe coloane", `${DA}`, `${NU} (listă)`, "6b"],
    ["Transformare în pacient cu verificare de dubluri", `${DA}`, `${PA} „Faceți programarea” găsește pacientul după telefon`, "6b"],
  ]],
  ["Pacienții", [
    ["Fișă, CNP verificat și criptat, anamneză, alerte, note clinice", `${DA}`, `${DA}`, "—"],
    ["Verificarea dublurilor la pacient nou (telefon, CNP, nume + dată, e-mail)", `${DA}`, `${PA} doar CNP unic și telefonul la programare`, "6b"],
    ["Etichete pe pacienți și filtru", `${DA}`, `${NU}`, "6b"],
    ["Note fixate sus, editare și ștergere de autor", `${DA}`, `${NU}`, "6b"],
    ["CNP mascat cu „Arătați” trecut în jurnal", `${DA}`, `${PA} mascat, fără „Arătați”`, "6b"],
    ["Tutore ca pacient legat (copii)", `${DA}`, `${PA} numele tutorelui ca text`, "6b"],
    ["Odontogramă, planuri, deviz tipărit", `${DA}`, `${DA}`, "—"],
    ["Urmărirea etapelor la implant", `${DA}`, `${NU}`, "6b"],
    ["Documente, consimțăminte, GDPR (export, anonimizare, registru), jurnal", `${DA}`, `${DA}`, "—"],
  ]],
  ["Facturare și rapoarte", [
    ["Facturi, încasări, avans, anulări cu motiv, numerotare fără goluri, CSV", `${DA}`, `${DA}`, "—"],
    ["Chitanța tipărită", `${NU}`, `${DA}`, "—"],
    ["Linii din programările finalizate (pe lângă planuri)", `${DA}`, `${NU}`, "6b"],
    ["e-Factura (SPV)", `${NU} pregătit, netrimis`, `${NU}`, "ulterior"],
    ["Rapoarte (venit pe medic, serviciu, metodă, programări, neprezentări, conversie)", `${DA}`, `${DA}`, "—"],
  ]],
  ["Mesaje, conturi, administrare", [
    ["SMS real", `${NU} simulat`, `${DA} SMSLink`, "—"],
    ["WhatsApp, campanii marketing, programul zilei pentru medici", `${NU}`, `${DA}`, "—"],
    ["Șabloane de mesaje editabile", `${DA}`, `${DA}`, "—"],
    ["Reamintirea cu o zi înainte", `${DA}`, `${DA}`, "—"],
    ["Conturi, roluri, clinici pe cont, blocare după încercări greșite", `${DA}`, `${DA}`, "—"],
    ["„Închideți toate sesiunile” unui cont; tema întunecată a panoului", `${DA}`, `${NU}`, "6b"],
    ["Servicii și prețuri, fotografii, echipă, setări", `${DA}`, `${DA}`, "—"],
    ["Tabletă de semnare, consultație și chat cu AI, actualizare din ZIP, manuale", `${NU}`, `${DA}`, "—"],
  ]],
];

let rows = "";
for (const [zona, items] of ZONE) {
  rows += `<tr class="zona"><td colspan="4">${zona}</td></tr>`;
  for (const [f, a, b, c] of items) rows += `<tr><td>${f}</td><td>${a}</td><td>${b}</td><td class="plan">${c}</td></tr>`;
}
const html = `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><style>${fonts}
@page { size: A4 landscape; margin: 14mm 13mm 16mm; }
body { font-family: 'Red Hat Text Variable', sans-serif; font-size: 9.6pt; line-height: 1.45; color: #252E2C; margin: 0; }
h1 { font-family: 'Forum', serif; font-weight: 400; font-size: 26pt; margin: 0; color: #252E2C; }
h2 { font-family: 'Forum', serif; font-weight: 400; font-size: 17pt; margin: 16pt 0 6pt; color: #1F6B4C; }
.sub { color: #5C6765; margin: 4pt 0 12pt; }
table { width: 100%; border-collapse: collapse; }
th { background: #1F6B4C; color: #fff; text-align: left; padding: 5pt 6pt; font-weight: 600; }
td { padding: 4pt 6pt; border-bottom: 1px solid #D3DDD9; vertical-align: top; }
tr { break-inside: avoid; }
tr.zona td { background: #E4F3EA; font-weight: 700; color: #1F6B4C; padding-top: 6pt; }
td.plan { white-space: nowrap; font-weight: 600; color: #1F6B4C; }
.da { color: #1F6B4C; font-weight: 800; } .nu { color: #B42318; font-weight: 800; } .pa { color: #B07A00; font-weight: 800; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt; }
.card { border: 1px solid #D3DDD9; border-radius: 8px; padding: 9pt 11pt; }
.card h3 { margin: 0 0 4pt; font-size: 11pt; color: #1F6B4C; }
ul { margin: 0; padding-left: 14pt; } li { margin-bottom: 2pt; }
.legenda { font-size: 8.5pt; color: #5C6765; margin: 6pt 0 10pt; }
</style></head><body>
<h1>Audit: prima versiune (Node.js) față de versiunea cPanel</h1>
<p class="sub">Dental Arena · ${new Date().toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })} · Ce exista atunci, ce există acum și ce refacem</p>
<div class="grid">
<div class="card"><h3>Pe scurt</h3><ul>
<li>Versiunea cPanel are în plus: SMS și WhatsApp reale, campanii, AI (consultație și chat), tableta de semnare, programul zilei pentru medici, chitanța tipărită, actualizarea din ZIP.</li>
<li>Îi lipsesc din prima versiune: <strong>programarea online cu oră aleasă</strong>, <strong>zilele libere și concediile</strong>, linkul pacientului, plus mai multe unelte de calendar și de cereri.</li></ul></div>
<div class="card"><h3>Etapa 6a (acum)</h3><ul>
<li>Concedii, formări, blocaje, zile libere ale clinicii; pauze în program.</li>
<li>Programarea pe site cu ore libere reale, ca în prima versiune, direct în calendar.</li>
<li>Linkul pacientului: confirmă, anulează, adaugă în calendar.</li>
<li>Conflictele din calendar: concediu, în afara programului, pacient suprapus.</li></ul></div>
<div class="card"><h3>Etapa 6b (imediat după)</h3><ul>
<li>Calendar cu tragere, redimensionare și „Anulați”; vedere listă; umbrire concedii.</li>
<li>Cereri cu atribuire, activități și tablou; dubluri la pacienți; etichete; note fixate.</li>
<li>Program clinici pe ore, cabinete, inhalosedare; „Primele ore libere” pe prima pagină; restul din tabel.</li></ul></div>
</div>
<p class="legenda">${DA} există · ${PA} parțial · ${NU} lipsește. Coloana „Refacem” arată etapa în care intră; „—” înseamnă că e la fel sau mai bine acum.</p>
<table><thead><tr><th style="width:27%">Funcționalitate</th><th style="width:30%">Prima versiune (Node.js)</th><th style="width:33%">Versiunea cPanel acum</th><th>Refacem</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Nici în prima versiune (de discutat separat)</h2>
<p>e-Factura trimisă în SPV, autentificare în doi pași, resetarea parolei pe e-mail, mutarea programării de către pacient din link, plata online.</p>
</body></html>`;
const f = path.join(here, ".audit.html");
fs.writeFileSync(f, html);
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(f).href);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(here, "Audit-versiuni.pdf"), format: "A4", landscape: true, printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: '<div style="width:100%;margin:0 13mm;font-family:sans-serif;font-size:7.5pt;color:#5C6765;display:flex;justify-content:space-between"><span>Dental Arena · Audit versiuni</span><span>pagina <span class="pageNumber"></span> din <span class="totalPages"></span></span></div>', margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" } });
await browser.close();
fs.rmSync(f);
console.log("docs/audit/Audit-versiuni.pdf");
