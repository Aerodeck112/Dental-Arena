/**
 * Screenshots for the user manuals (docs/manuale), from a local copy of the PHP site with demo
 * data (php/README.md → Local test environment). Run: node scripts/manual/capturi.mjs [URL]
 * Writes scripts/manual/.capturi/*.jpg (not committed).
 */
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const B = process.argv[2] || "http://127.0.0.1:8081";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".capturi");
fs.mkdirSync(OUT, { recursive: true });
const ACCOUNTS = {
  admin: ["admin@dentalarena.ro", "ParolaTest-2026"],
  receptie: ["receptie.test@dentalarena.ro", "ParolaMea-Ludus-1"],
  medic: ["dr.test@dentalarena.ro", "ParolaMedic-2026"],
  vitim: ["vitim@vitim.ro", "ParolaVitim-2026"],
};
// The demo database (Docker, php/README.md): ids and dates the pictures need.
const sql = (q) => execSync(`docker exec da-db mariadb -uroot -prootpw cont_dentalarena -N -e "${q}"`).toString().trim();
const T = sql("SELECT DATE_ADD(CURDATE(), INTERVAL 1 DAY)");
const ONLINE = sql(`SELECT id FROM appointments WHERE patient_id = 6 AND DATE(starts_at) = '${T}' LIMIT 1`);
const VITIM = sql("SELECT id FROM users WHERE email = 'vitim@vitim.ro'");
const LINK = process.env.LINK || "";
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
  // VITIM first: its changes then show on the administrator's „Azi”.
  ["setari", "vitim", "/admin/setari", { h: 1000 }],
  ["setari-clinica", "vitim", "/admin/setari", { el: "section:has(#clinica-1)" }],
  ["setari-module", "vitim", "/admin/setari", { el: "section:has(#module)" }],
  ["setari-programari", "vitim", "/admin/setari/programari", { h: 1300 }],
  ["setari-mesaje", "vitim", "/admin/setari/mesaje", { h: 1300 }],
  ["setari-ai", "vitim", "/admin/setari/ai", { el: "main" }],
  ["setari-chat", "vitim", "/admin/setari/chat", { el: "main" }],
  ["tablete", "vitim", "/admin/tablete", { el: "main" }],
  ["utilizatori", "vitim", "/admin/utilizatori", { h: 700 }],
  ["utilizator", "vitim", "/admin/utilizatori/2", { el: "main" }],
  ["vitim-schimbare", "vitim", "/admin/setari/chat", { nocapture: true, before: async (p) => { await p.fill("#field-daily_limit", "250"); await Promise.all([p.waitForNavigation(), p.locator("main form button[type=submit]:has-text('Salvați')").first().click()]); } }],
  ["azi", "admin", "/admin?clinica=1", { h: 820 }],
  ["azi-vitim", "admin", "/admin?clinica=1", { el: "section:has(#vitim)" }],
  ["azi-medic", "medic", "/admin?clinica=1", { h: 820 }],
  ["azi-receptie", "receptie", "/admin?clinica=2", { h: 820 }],
  ["calendar-zi", "admin", `/admin/calendar?clinica=1&data=${T}`, { h: 1150 }],
  ["calendar-mutare", "admin", `/admin/calendar?clinica=1&data=${T}`, { vp: true, before: async (p) => {
    const el = p.locator(`[data-appt='${ONLINE}']`); const bb = await el.boundingBox(); const h = (await p.locator("[data-cal-row]").boundingBox()).height;
    await el.scrollIntoViewIfNeeded(); const b2 = await el.boundingBox();
    await p.mouse.move(b2.x + b2.width / 2, b2.y + 8); await p.mouse.down(); await p.mouse.move(b2.x + b2.width / 2, b2.y + 8 + h, { steps: 4 }); await p.mouse.move(b2.x + b2.width / 2, b2.y + 8 + h * 2, { steps: 4 }); await p.mouse.up();
    await p.locator("[data-cal-anunt]:not([hidden])").waitFor(); }, after: async (p) => { await p.locator("[data-cal-anunt] button").click(); await p.waitForTimeout(800); } }],
  ["calendar-cabinete", "admin", `/admin/calendar?clinica=1&data=${T}&coloane=cabinete`, { h: 900 }],
  ["calendar-lista", "admin", `/admin/calendar?clinica=1&data=${T}&vizualizare=lista`, { h: 1000 }],
  ["calendar-saptamana", "admin", `/admin/calendar?clinica=1&vizualizare=saptamana&data=${T}`, { h: 820 }],
  ["absente", "admin", "/admin/absente", { h: 1250 }],
  ["programare-noua", "receptie", "/admin/programari/noua?clinica=2", { el: "main" }],
  ["programare", "receptie", `/admin/programari/${ONLINE}`, { h: 1000 }],
  ["programare-avertisment", "receptie", `/admin/programari/noua?clinica=1&medic=1&data=${T}&ora=13:15&pacient=6`, { h: 760, before: async (p) => { await Promise.all([p.waitForNavigation(), p.locator("main form button[type=submit]:has-text('Faceți programarea')").click()]); } }],
  ["pacienti", "receptie", "/admin/pacienti", { h: 820 }],
  ["pacient-nou", "receptie", "/admin/pacienti/nou", { el: "main" }],
  ["pacient-nou-dubluri", "receptie", "/admin/pacienti/nou", { h: 900, before: async (p) => { await p.fill("#field-last_name", "Popescu"); await p.fill("#field-first_name", "Maria"); await p.fill("#field-phone", "0744 555 111"); await Promise.all([p.waitForNavigation(), p.locator("button:has-text('Creați fișa')").click()]); } }],
  ["fisa-receptie", "receptie", "/admin/pacienti/1", { h: 1100 }],
  ["fisa-medic", "medic", "/admin/pacienti/1", { h: 1300 }],
  ["fisa-etichete", "receptie", "/admin/pacienti/1", { el: "section:has(#etichete)" }],
  ["fisa-note", "receptie", "/admin/pacienti/1", { el: "section:has(#note)" }],
  ["fisa-implant", "medic", "/admin/pacienti/1", { el: "section:has(#implanturi)" }],
  ["implanturi", "medic", "/admin/implanturi", { h: 650 }],
  ["odontograma", "medic", "/admin/pacienti/1/odontograma", { el: "main" }],
  ["odontograma-dinte", "medic", "/admin/pacienti/1/odontograma", { el: "main", before: async (p) => { const t = p.locator("[data-dinte='36'], [data-tooth='36'], a[href*='dinte=36']").first(); if (await t.count()) await t.click(); await p.waitForTimeout(400); } }],
  ["planuri", "medic", "/admin/pacienti/1/planuri", { el: "main" }],
  ["plan", "medic", "/admin/pacienti/1/planuri/1", { el: "main" }],
  ["plan-tipar", "medic", "/admin/pacienti/1/planuri/1/tipar", { h: 1100 }],
  ["consultatie-ai", "medic", "/admin/pacienti/1/consultatie-ai", { el: "main" }],
  ["documente", "receptie", "/admin/pacienti/1/documente", { el: "main" }],
  ["acord-tipar", "receptie", "/admin/pacienti/1/acord/tratament", { h: 1100 }],
  ["pacient-mesaje", "receptie", "/admin/pacienti/1/mesaje", { el: "main" }],
  ["pacient-gdpr", "admin", "/admin/pacienti/1/gdpr", { h: 1250 }],
  ["cereri", "receptie", "/admin/cereri", { h: 820 }],
  ["cereri-tablou", "receptie", "/admin/cereri?vizualizare=tablou", { h: 1000 }],
  ["cerere", "receptie", "/admin/cereri/3", { h: 1500 }],
  ["rechemari", "receptie", "/admin/rechemari?clinica=1", { h: 820 }],
  ["mesaje", "receptie", "/admin/mesaje", { h: 820 }],
  ["chat", "receptie", "/admin/chat", { h: 820 }],
  ["chat-conversatie", "receptie", "/admin/chat/7", { el: "main" }],
  ["rapoarte", "admin", "/admin/rapoarte", { h: 1100 }],
  ["rapoarte-pierdute", "admin", "/admin/rapoarte", { el: "section:has(#pierdute)" }],
  ["rapoarte-medic", "medic", "/admin/rapoarte", { h: 820 }],
  ["cont", "medic", "/admin/cont", { el: "main" }],
  ["servicii", "admin", "/admin/servicii", { h: 820 }],
  ["servicii-pagina", "admin", "/admin/servicii/implantologie", { h: 1000 }],
  ["servicii-online", "admin", "/admin/servicii/consultatie-profilaxie", { el: "main ul li:has(details[open])" }],
  ["fotografii", "admin", "/admin/fotografii", { h: 900 }],
  ["echipa", "admin", "/admin/echipa", { h: 820 }],
  ["medic-profil", "admin", "/admin/echipa/1", { h: 1000 }],
  ["medic-program", "admin", "/admin/echipa/1", { el: "section:has(#clinici)" }],
  ["medic-agenda", "admin", "/admin/echipa/2", { el: "section:has(#agenda)" }],
  ["marketing", "admin", "/admin/marketing", { h: 820 }],
  ["campanie-noua", "admin", "/admin/marketing/noua", { el: "main" }],
  ["gdpr", "admin", "/admin/gdpr", { el: "main" }],
  ["jurnal", "admin", "/admin/jurnal", { h: 820 }],
  ["site-acasa", "public", "/", { h: 1150 }],
  ["site-programare", "public", "/programare", { h: 1150 }],
  ["site-programare-ore", "public", "/programare", { el: "[data-pas='2']", before: async (p) => {
    await p.locator("[data-programare] label:has-text('Consultație sau control')").click(); await p.locator("[data-programare] label:has-text('Cristești')").first().click();
    await p.locator("[data-pas='1'] [data-inainte]").click(); await p.locator("[data-ore] button").first().waitFor(); await p.locator("[data-ore] button").nth(2).click(); } }],
  ["site-link", "public", `/p/${LINK}`, { h: 900 }],
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
  if (o.nocapture) continue;
  const file = path.join(OUT, `${name}.jpg`);
  if (o.vp) {
    await p.screenshot({ path: file, type: "jpeg", quality: 82 });
  } else if (o.el) {
    await p.locator(o.el).first().screenshot({ path: file, type: "jpeg", quality: 82 });
  } else {
    const height = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: file, type: "jpeg", quality: 82, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(o.h || 820, height) } });
  }
  if (o.after) await o.after(p);
  console.log("✓", name);
}
await browser.close();
