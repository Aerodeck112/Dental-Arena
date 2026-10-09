/**
 * Builds the PHP version of the site (php/README.md):
 *   1. the texts, prices, team, icons and drawings as JSON (export-data.tsx → php/app/data)
 *   2. the stylesheet, from the same design tokens (src/app/globals.css) and the PHP templates
 *   3. the fonts (self-hosted, Latin + Latin Extended for ă â î ș ț)
 *   4. the photos as WebP in several widths, plus a manifest the templates read
 *   5. with --package: deploy/dentalarena-php.zip (public_html/ + dentalarena/) for cPanel
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const php = path.join(root, "php");
const pub = path.join(php, "public");
const app = path.join(php, "app");
const rel = (p) => path.relative(root, p);
const step = (s) => console.log(`\n${s}`);

// --css: only the stylesheet (after editing templates).
const cssOnly = process.argv.includes("--css");

step("1/5 Texte, prețuri, echipă, iconițe și desene");
if (!cssOnly) {
  execFileSync(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "--tsconfig", "tsconfig.json", "scripts/php/export-data.tsx"], {
    cwd: root,
    stdio: "inherit",
  });
}

step("2/5 Stiluri (Tailwind, din globals.css și șabloanele PHP)");
const buildDir = path.join(php, ".build");
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(path.join(pub, "assets"), { recursive: true });
const tokens = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace(/^@import "tailwindcss";\s*/, "");
const entry = path.join(buildDir, "site.css");
fs.writeFileSync(
  entry,
  [
    '@import "tailwindcss" source(none);',
    '@source "../app/templates";',
    '@source "../app/src";',
    '@source "../public/assets/site.js";',
    '@source "../public/assets/admin.js";',
    // next/font set these on <html>; here the self-hosted families of step 3.
    ":root { --font-forum: 'Forum'; --font-redhat: 'Red Hat Text Variable'; }",
    '@import "./fonts.css";',
    tokens,
  ].join("\n"),
);

step("3/5 Fonturi");
const fontsOut = path.join(pub, "assets/fonts");
fs.mkdirSync(fontsOut, { recursive: true });
let fontCss = "";
for (const [pkg, css] of [
  ["@fontsource/forum", "latin-ext-400.css"],
  ["@fontsource/forum", "latin-400.css"],
  ["@fontsource-variable/red-hat-text", "index.css"],
]) {
  const dir = path.join(root, "node_modules", pkg);
  const text = fs.readFileSync(path.join(dir, css), "utf8");
  fontCss += text.replace(/url\(\.\/files\/([^)]+)\)/g, (_, file) => {
    fs.copyFileSync(path.join(dir, "files", file), path.join(fontsOut, file));
    return `url(/assets/fonts/${file})`;
  });
}
fs.writeFileSync(path.join(buildDir, "fonts.css"), fontCss);

const result = await postcss([tailwind({ base: php, optimize: { minify: true } })]).process(fs.readFileSync(entry, "utf8"), {
  from: entry,
  to: path.join(pub, "assets/site.css"),
});
fs.writeFileSync(path.join(pub, "assets/site.css"), result.css);
console.log(`${rel(path.join(pub, "assets/site.css"))}: ${Math.round(result.css.length / 1024)} KB`);

// The browser script, minified (the readable source stays in assets/site.js).
const { transform } = await import("esbuild");
for (const name of ["site", "admin"]) {
  const file = path.join(pub, `assets/${name}.js`);
  if (fs.existsSync(file)) {
    const min = await transform(fs.readFileSync(file, "utf8"), { minify: true, target: "es2017" });
    fs.writeFileSync(path.join(pub, `assets/${name}.min.js`), min.code);
  }
}

if (cssOnly) process.exit(0);

step("4/5 Fotografii (WebP în mai multe lățimi)");
const WIDTHS = [480, 800, 1200, 1600];
const manifest = {};
const srcImages = path.join(root, "public/images");
for (const dir of fs.readdirSync(srcImages)) {
  fs.mkdirSync(path.join(pub, "images", dir), { recursive: true });
  for (const file of fs.readdirSync(path.join(srcImages, dir))) {
    const src = path.join(srcImages, dir, file);
    const key = `/images/${dir}/${file}`;
    fs.copyFileSync(src, path.join(pub, "images", dir, file));
    const meta = await sharp(src).metadata();
    const base = file.replace(/\.[a-z]+$/i, "");
    const widths = WIDTHS.filter((w) => w < meta.width);
    widths.push(Math.min(meta.width, 2000));
    const variants = [];
    for (const w of [...new Set(widths)]) {
      const name = `${base}-${w}.webp`;
      const target = path.join(pub, "images", dir, name);
      if (!fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(src).mtimeMs) {
        await sharp(src).resize({ width: w }).webp({ quality: 74 }).toFile(target);
      }
      const avif = target.replace(/\.webp$/, ".avif");
      if (!fs.existsSync(avif) || fs.statSync(avif).mtimeMs < fs.statSync(src).mtimeMs) {
        await sharp(src).resize({ width: w }).avif({ quality: 50 }).toFile(avif);
      }
      variants.push({ w, src: `/images/${dir}/${name}`, avif: `/images/${dir}/${base}-${w}.avif` });
    }
    manifest[key] = { width: meta.width, height: meta.height, variants };
  }
}
fs.writeFileSync(path.join(app, "data/images.json"), `${JSON.stringify(manifest, null, 1)}\n`);
for (const f of ["favicon.ico", "apple-touch-icon.png"]) fs.copyFileSync(path.join(root, "public", f), path.join(pub, f));
fs.cpSync(path.join(root, "public/brand"), path.join(pub, "brand"), { recursive: true });
// The logo at the widths it is shown (header 150px, footer 300px; 1x and 2x screens).
for (const w of [320, 480]) {
  await sharp(path.join(root, "public/brand/logo-dental-arena.png")).resize({ width: w }).webp({ quality: 88, alphaQuality: 100 }).toFile(path.join(pub, `brand/logo-dental-arena-${w}.webp`));
}
console.log(`${Object.keys(manifest).length} fotografii`);

if (process.argv.includes("--package")) {
  step("5/5 Arhiva pentru cPanel");
  const deploy = path.join(root, "deploy/dentalarena-php");
  fs.rmSync(deploy, { recursive: true, force: true });
  fs.mkdirSync(deploy, { recursive: true });
  fs.cpSync(pub, path.join(deploy, "public_html"), { recursive: true });
  fs.cpSync(app, path.join(deploy, "dentalarena"), {
    recursive: true,
    filter: (p) => !p.endsWith("config.php") && !p.includes(`${path.sep}storage${path.sep}`),
  });
  fs.mkdirSync(path.join(deploy, "dentalarena/storage"), { recursive: true });
  // Photos uploaded from the panel live in public_html/media; an update must not wipe them.
  fs.rmSync(path.join(deploy, "public_html/media"), { recursive: true, force: true });
  fs.copyFileSync(path.join(root, "docs/cpanel-php.md"), path.join(deploy, "CITESTE-MA.md"));
  const zip = path.join(root, "deploy/dentalarena-php.zip");
  fs.rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "public_html", "dentalarena", "CITESTE-MA.md"], { cwd: deploy });
  console.log(`Gata: ${rel(zip)} (${Math.round(fs.statSync(zip).size / 1024 / 1024)} MB)`);
} else {
  step("5/5 Arhiva: sărită (rulați cu --package)");
}
