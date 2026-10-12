/**
 * Builds the three user manuals as PDF (docs/manuale): reception, doctors, administrator.
 * Needs the screenshots from capturi.mjs (scripts/manual/.capturi), Playwright's Chromium and
 * poppler (pdftotext, pdfunite). Run: node scripts/manual/manuale.mjs
 *
 * Each manual: a cover (own PDF, no footer) + the body (table of contents with page numbers,
 * chapters, footer „Dental Arena · Manual … · pagina X din Y”), joined with pdfunite. The page
 * numbers in the contents come from a first pass: each chapter carries an invisible marker that
 * pdftotext finds.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as C from "./continut.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const shots = path.join(here, ".capturi");
const outDir = path.join(root, "docs/manuale");
const tmp = path.join(here, ".tmp");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });

const parte = (titlu) => ({ parte: titlu });
const MANUALE = [
  {
    fisier: "Manual-Receptie.pdf",
    rol: "recepție",
    scurt: "Manual pentru recepție",
    intro: "Programări, pacienți, cereri de pe site, rechemări, facturi și încasări, acorduri pe tabletă, mesaje.",
    capitole: [C.despre("recepție"), C.intrare(), C.ecranul(), C.azi("receptie"), C.calendar(), C.programari(), C.pacienti("receptie"), C.cereri(), C.rechemari(), C.facturi("receptie"), C.planuri("receptie"), C.documente("receptie"), C.tableta("receptie"), C.mesaje("receptie"), C.chat("receptie"), C.rapoarte("receptie"), C.intrebari("receptie")],
  },
  {
    fisier: "Manual-Medici.pdf",
    rol: "medici",
    scurt: "Manual pentru medici",
    intro: "Ziua de lucru, fișa pacientului, anamneza, odontograma, planurile de tratament, consultația cu AI, programul zilei pe WhatsApp.",
    capitole: [C.despre("medici"), C.intrare(), C.ecranul(), C.azi("medic"), C.calendar(), C.programari(), C.pacienti("medic"), C.anamneza(), C.odontograma(), C.planuri("medic"), C.consultatieAi(), C.documente("medic"), C.programulZilei("medic"), C.mesaje("medic"), C.rapoarte("medic"), C.intrebari("medic")],
  },
  {
    fisier: "Manual-Administrator.pdf",
    rol: "administrator",
    scurt: "Manual pentru administrator",
    intro: "Tot panoul: lucrul zilnic, partea medicală și administrarea (setări, echipă, prețuri, mesaje, marketing, AI, chat, tablete, GDPR, jurnal, întreținere).",
    capitole: [
      C.despre("administrator"), C.intrare(), C.ecranul(),
      parte("Lucrul de zi cu zi"),
      C.azi("receptie"), C.calendar(), C.programari(), C.pacienti("medic"), C.cereri(), C.rechemari(), C.facturi("admin"), C.documente("admin"), C.tableta("admin"), C.mesaje("admin"), C.chat("admin"), C.rapoarte("admin"),
      parte("Partea medicală"),
      C.anamneza(), C.odontograma(), C.planuri("admin"), C.consultatieAi(),
      parte("Administrarea"),
      C.setari(), C.utilizatori(), C.echipa(), C.programulZilei("admin"), C.servicii(), C.fotografii(), C.setariMesaje(), C.marketing(), C.setariAi(), C.gdpr(), C.jurnal(), C.siteul(), C.intretinere(), C.intrebari("admin"),
    ],
  },
];

// The site's own fonts (with their unicode ranges, so ă â î ș ț come from the Latin Extended file).
const fontsCss = fs.readFileSync(path.join(root, "php/.build/fonts.css"), "utf8").replace(/url\(\/assets\/fonts\//g, `url(${pathToFileURL(path.join(root, "php/public/assets/fonts")).href}/`);
const logo = pathToFileURL(path.join(root, "php/public/brand/logo-dental-arena.png")).href;
const LUNA = "octombrie 2026";

const CSS = `
${fontsCss}
:root { --verde: #1F6B4C; --cerneala: #252E2C; --discret: #5C6765; --linie: #D3DDD9; --menta: #E4F3EA; --mustar: #FBEFC9; --mustar-t: #7A5600; --carmin: #B42318; --carmin-p: #FBE9E7; --fundal: #F4F7F5; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Red Hat Text Variable', sans-serif; font-size: 10.4pt; line-height: 1.55; color: var(--cerneala); }
h1, h2, .cifra { font-family: 'Forum', serif; font-weight: 400; }
.capitol { break-before: page; }
.capitol > h2 { display: flex; align-items: baseline; gap: 10pt; font-size: 24pt; line-height: 1.1; margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 2px solid var(--verde); }
.capitol > h2 .nr { color: var(--verde); }
.parte { break-before: page; height: 230mm; display: flex; flex-direction: column; justify-content: center; }
.parte p { margin: 0; color: var(--verde); font-weight: 600; letter-spacing: .08em; text-transform: uppercase; font-size: 9pt; }
.parte h2 { font-size: 34pt; margin: 6pt 0 0; }
h3 { font-size: 12.5pt; margin: 16pt 0 6pt; color: var(--verde); break-after: avoid; }
p { margin: 0 0 8pt; }
ul { margin: 0 0 9pt; padding-left: 16pt; } li { margin-bottom: 3pt; }
b.ui { font-weight: 650; background: var(--fundal); border: 1px solid var(--linie); border-radius: 4px; padding: 0 3pt; white-space: nowrap; }
ol.pasi { counter-reset: p; list-style: none; padding: 0; margin: 0 0 10pt; }
ol.pasi > li { counter-increment: p; position: relative; padding-left: 26pt; margin-bottom: 6pt; min-height: 18pt; }
ol.pasi > li::before { content: counter(p); position: absolute; left: 0; top: 0; width: 18pt; height: 18pt; border-radius: 50%; background: var(--verde); color: #fff; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
aside { border-radius: 8px; padding: 8pt 11pt; margin: 0 0 11pt; break-inside: avoid; font-size: 10pt; }
aside.sfat { background: var(--menta); border-left: 4px solid var(--verde); }
aside.atentie { background: var(--mustar); border-left: 4px solid #C99A06; }
aside strong { color: var(--verde); } aside.atentie strong { color: var(--mustar-t); }
figure { margin: 4pt 0 14pt; break-inside: avoid; text-align: center; }
figure img { display: block; margin: 0 auto; max-width: 100%; max-height: 175mm; border: 1px solid var(--linie); border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
figure.mic img { max-width: 62%; }
figcaption { margin-top: 5pt; font-size: 8.8pt; color: var(--discret); font-style: italic; }
table { width: 100%; border-collapse: collapse; margin: 2pt 0 12pt; font-size: 9.6pt; break-inside: avoid; }
th { text-align: left; background: var(--verde); color: #fff; font-weight: 600; padding: 5pt 7pt; }
td { padding: 5pt 7pt; border-bottom: 1px solid var(--linie); vertical-align: top; }
tr:nth-child(even) td { background: var(--fundal); }
.adresa { font-size: 14pt; font-weight: 700; color: var(--verde); text-align: center; background: var(--menta); border-radius: 8px; padding: 8pt; }
.adresa-inline { font-weight: 650; color: var(--verde); }
dl.faq dt { font-weight: 700; margin-top: 9pt; } dl.faq dd { margin: 2pt 0 0; }
.marcaj { font-size: 1pt; color: #fff; line-height: 1; height: 1pt; overflow: hidden; }
.cuprins h2 { font-size: 26pt; margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 2px solid var(--verde); }
.cuprins ol { list-style: none; padding: 0; margin: 0; }
.cuprins li { display: flex; align-items: baseline; gap: 6pt; padding: 3.2pt 0; font-size: 10.8pt; }
.cuprins li.parte-t { margin-top: 9pt; font-weight: 700; color: var(--verde); text-transform: uppercase; letter-spacing: .06em; font-size: 8.5pt; }
.cuprins .nr { width: 20pt; color: var(--verde); font-weight: 700; }
.cuprins .pct { flex: 1; border-bottom: 1px dotted #9AA8A4; transform: translateY(-3pt); }
.cuprins a { color: inherit; text-decoration: none; }
`;

function corp(m, pagini) {
  let n = 0;
  const cuprins = [];
  const capitole = [];
  for (const c of m.capitole) {
    if (c.parte) {
      cuprins.push(`<li class="parte-t">${c.parte}</li>`);
      capitole.push(`<section class="parte"><p>Partea</p><h2>${c.parte}</h2></section>`);
      continue;
    }
    n++;
    cuprins.push(`<li><span class="nr">${n}.</span><a href="#c${n}">${c.titlu}</a><span class="pct"></span><span>${pagini?.[n] ?? "00"}</span></li>`);
    capitole.push(`<section class="capitol" id="c${n}"><div class="marcaj">§§c${n}§§</div><h2><span class="nr cifra">${n}</span>${c.titlu}</h2>${c.html}</section>`);
  }
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><base href="${pathToFileURL(shots).href}/"><style>${CSS}</style></head><body>
<section class="cuprins"><h2>Cuprins</h2><ol>${cuprins.join("")}</ol></section>
${capitole.join("\n")}</body></html>`;
}

function coperta(m) {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><style>${CSS}
body { height: 297mm; margin: 0; }
.cop { height: 297mm; display: flex; flex-direction: column; padding: 28mm 22mm 20mm; background: linear-gradient(180deg, #fff 0%, #fff 58%, var(--fundal) 58%); }
.cop img { width: 70mm; }
.cop .eticheta { margin-top: 42mm; color: var(--verde); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 10pt; }
.cop h1 { font-size: 44pt; line-height: 1.05; margin: 8pt 0 0; }
.cop .rol { font-family: 'Forum', serif; font-size: 30pt; color: var(--verde); margin-top: 6pt; }
.cop .intro { margin-top: 18pt; font-size: 12pt; color: var(--discret); max-width: 150mm; }
.cop .jos { margin-top: auto; display: flex; justify-content: space-between; font-size: 9.5pt; color: var(--discret); border-top: 1px solid var(--linie); padding-top: 8pt; }
</style></head><body><div class="cop">
<img src="${logo}" alt="Dental Arena">
<p class="eticheta">Site și panou (CRM)</p>
<h1>Manual de utilizare</h1>
<p class="rol">pentru ${m.rol}</p>
<p class="intro">${m.intro}</p>
<div class="jos"><span>Dental Arena · Cristești și Luduș, Mureș</span><span>Ediția ${LUNA}</span></div>
</div></body></html>`;
}

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage();
async function pdf(html, file, footer) {
  const f = path.join(tmp, "pagina.html");
  fs.writeFileSync(f, html);
  await page.goto(pathToFileURL(f).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    margin: footer ? { top: "17mm", right: "16mm", bottom: "19mm", left: "16mm" } : { top: "0", right: "0", bottom: "0", left: "0" },
    displayHeaderFooter: !!footer,
    headerTemplate: "<span></span>",
    footerTemplate: footer
      ? `<div style="width:100%;margin:0 16mm;padding-top:4pt;border-top:0.5pt solid #D3DDD9;display:flex;justify-content:space-between;font-family:sans-serif;font-size:7.5pt;color:#5C6765"><span>Dental Arena · ${footer}</span><span>pagina <span class="pageNumber"></span> din <span class="totalPages"></span></span></div>`
      : "<span></span>",
  });
}

for (const m of MANUALE) {
  const body = path.join(tmp, "corp.pdf");
  await pdf(corp(m), body, m.scurt);
  // Where each chapter landed (form feeds split the pages).
  const text = execFileSync("pdftotext", [body, "-"]).toString().split("\f");
  const pagini = {};
  text.forEach((t, i) => {
    for (const mm of t.matchAll(/§§c(\d+)§§/g)) pagini[mm[1]] ??= i + 1;
  });
  await pdf(corp(m, pagini), body, m.scurt);
  const cop = path.join(tmp, "coperta.pdf");
  await pdf(coperta(m), cop, null);
  const out = path.join(outDir, m.fisier);
  execFileSync("pdfunite", [cop, body, out]);
  const info = execFileSync("pdfinfo", [out]).toString().match(/Pages:\s+(\d+)/)[1];
  console.log(`${m.fisier}: ${info} pagini, ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
