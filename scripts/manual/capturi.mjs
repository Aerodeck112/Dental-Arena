/**
 * Screenshots for the user manuals (docs/manuale), from a local copy of the PHP site with demo
 * data (php/README.md → Local test environment). Run: node scripts/manual/capturi.mjs [URL]
 * Writes scripts/manual/.capturi/*.jpg (not committed).
 */
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const B = process.argv[2] || "http://127.0.0.1:8081";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".capturi");
fs.mkdirSync(OUT, { recursive: true });
const ACCOUNTS = {
  admin: ["admin@dentalarena.ro", "ParolaTest-2026"],
  receptie: ["receptie.test@dentalarena.ro", "ParolaMea-Ludus-1"],
  medic: ["dr.test@dentalarena.ro", "ParolaMedic-2026"],
};
const only = process.env.DOAR ? process.env.DOAR.split(",") : null;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const pages = {};
async function as(role, mobile = false) {
  const key = role + (mobile ? "-m" : "");
  if (pages[key]) return pages[key];
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.dismiss());
  if (role !== "public") {
    await p.goto(B + "/admin/intrare");
    await p.fill("#field-email", ACCOUNTS[role][0]);
    await p.fill("#field-password", ACCOUNTS[role][1]);
    await Promise.all([p.waitForNavigation(), p.locator("main button[type=submit]").click()]);
  }
  pages[key] = p;
  return p;
}
// name, role, url, options: el (selector to capture), full (whole page), h (height of the top part), before (actions)
const SHOTS = [
  ["intrare", "public", "/admin/intrare", { h: 700 }],
  ["azi", "admin", "/admin?clinica=1", { h: 820 }],
  ["azi-medic", "medic", "/admin?clinica=1", { h: 820 }],
  ["calendar-zi", "admin", "/admin/calendar?clinica=1", { h: 820 }],
  ["calendar-saptamana", "admin", "/admin/calendar?clinica=1&vizualizare=saptamana", { h: 820 }],
  ["programare-noua", "receptie", "/admin/programari/noua?clinica=2", { el: "main" }],
  ["programare", "receptie", "/admin/programari/18", { el: "main" }],
  ["pacienti", "receptie", "/admin/pacienti", { h: 820 }],
  ["pacient-nou", "receptie", "/admin/pacienti/nou", { el: "main" }],
  ["fisa-receptie", "receptie", "/admin/pacienti/1", { h: 1100 }],
  ["fisa-medic", "medic", "/admin/pacienti/1", { h: 1300 }],
  ["odontograma", "medic", "/admin/pacienti/1/odontograma", { el: "main" }],
  ["odontograma-dinte", "medic", "/admin/pacienti/1/odontograma", { el: "main", before: async (p) => { const t = p.locator("[data-dinte='36'], [data-tooth='36'], a[href*='dinte=36']").first(); if (await t.count()) await t.click(); await p.waitForTimeout(400); } }],
  ["planuri", "medic", "/admin/pacienti/1/planuri", { el: "main" }],
  ["plan", "medic", "/admin/pacienti/1/planuri/1", { el: "main" }],
  ["plan-tipar", "medic", "/admin/pacienti/1/planuri/1/tipar", { h: 1100 }],
  ["consultatie-ai", "medic", "/admin/pacienti/1/consultatie-ai", { el: "main" }],
  ["documente", "receptie", "/admin/pacienti/1/documente", { el: "main" }],
  ["acord-tipar", "receptie", "/admin/pacienti/1/acord/tratament", { h: 1100 }],
  ["financiar", "receptie", "/admin/pacienti/1/financiar", { el: "main" }],
  ["pacient-mesaje", "receptie", "/admin/pacienti/1/mesaje", { el: "main" }],
  ["pacient-gdpr", "admin", "/admin/pacienti/1/gdpr", { h: 1250 }],
  ["cereri", "receptie", "/admin/cereri", { h: 820 }],
  ["cerere", "receptie", "/admin/cereri/2", { el: "main" }],
  ["rechemari", "receptie", "/admin/rechemari?clinica=1", { h: 820 }],
  ["azi-receptie", "receptie", "/admin?clinica=2", { h: 820 }],
  ["facturi", "receptie", "/admin/facturi", { h: 820 }],
  ["factura-noua", "receptie", "/admin/facturi/noua?pacient=1", { el: "main" }],
  ["factura", "receptie", "/admin/facturi/1", { el: "main" }],
  ["factura-tipar", "receptie", "/admin/facturi/1/tipar", { h: 1100 }],
  ["incasari", "receptie", "/admin/incasari", { h: 820 }],
  ["mesaje", "receptie", "/admin/mesaje", { h: 820 }],
  ["chat", "receptie", "/admin/chat", { h: 820 }],
  ["chat-conversatie", "receptie", "/admin/chat/7", { el: "main" }],
  ["rapoarte", "admin", "/admin/rapoarte", { h: 1200 }],
  ["rapoarte-medic", "medic", "/admin/rapoarte", { h: 820 }],
  ["cont", "medic", "/admin/cont", { el: "main" }],
  ["setari", "admin", "/admin/setari", { h: 1000 }],
  ["setari-mesaje", "admin", "/admin/setari/mesaje", { h: 1300 }],
  ["setari-ai", "admin", "/admin/setari/ai", { el: "main" }],
  ["setari-chat", "admin", "/admin/setari/chat", { el: "main" }],
  ["tablete", "admin", "/admin/tablete", { el: "main" }],
  ["servicii", "admin", "/admin/servicii", { h: 820 }],
  ["servicii-pagina", "admin", "/admin/servicii/implantologie", { h: 1000 }],
  ["fotografii", "admin", "/admin/fotografii", { h: 900 }],
  ["echipa", "admin", "/admin/echipa", { h: 820 }],
  ["medic-profil", "admin", "/admin/echipa/2", { h: 1000 }],
  ["medic-program", "admin", "/admin/echipa/2", { el: "section:has(#clinici)" }],
  ["medic-agenda", "admin", "/admin/echipa/2", { el: "section:has(#agenda)" }],
  ["utilizatori", "admin", "/admin/utilizatori", { h: 700 }],
  ["utilizator", "admin", "/admin/utilizatori/2", { el: "main" }],
  ["marketing", "admin", "/admin/marketing", { h: 820 }],
  ["campanie-noua", "admin", "/admin/marketing/noua", { el: "main" }],
  ["gdpr", "admin", "/admin/gdpr", { el: "main" }],
  ["jurnal", "admin", "/admin/jurnal", { h: 820 }],
  ["site-acasa", "public", "/", { h: 820 }],
  ["site-programare", "public", "/programare", { h: 1100 }],
  ["site-preturi", "public", "/preturi", { h: 820 }],
];

for (const [name, role, url, o] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const p = await as(role);
  await p.goto(B + url);
  // The cookie notice is not part of the screens being explained.
  await p.evaluate(() => {
    document.querySelector("#cookie-uri")?.remove();
    document.querySelector("[data-chat]")?.setAttribute("hidden", "");
  });
  // Sticky bars (totals, „Salvați”) would cover the form in a whole-page picture.
  await p.evaluate(() => document.querySelectorAll("main *").forEach((e) => { if (getComputedStyle(e).position === "sticky") e.style.position = "static"; }));
  if (o.before) await o.before(p);
  const file = path.join(OUT, `${name}.jpg`);
  if (o.el) {
    await p.locator(o.el).first().screenshot({ path: file, type: "jpeg", quality: 82 });
  } else {
    const height = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: file, type: "jpeg", quality: 82, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(o.h || 820, height) } });
  }
  console.log("✓", name);
}
await browser.close();
