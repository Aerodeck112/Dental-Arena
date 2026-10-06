/**
 * Builds the logo files the site uses from the ORIGINAL logo of dentalarena.ro (research/media).
 * The artwork is not redrawn: the white background is only made transparent, so the logo also
 * sits on tinted backgrounds. Run: node scripts/build-logo-assets.mjs
 */
import sharp from "sharp";
const src = "research/media/164964094_176511157596179_4287899319184109583_n-e1716794678679.jpg";
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const out = Buffer.alloc(W * H * 4);
// Un-composite from white: alpha = max channel distance from white; colour = (c - 255(1-a))/a.
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  let a = Math.max(255 - r, 255 - g, 255 - b) / 255;
  if (a < 0.04) a = 0;
  const f = (c) => (a === 0 ? 0 : Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a))));
  out[i * 4] = f(r); out[i * 4 + 1] = f(g); out[i * 4 + 2] = f(b); out[i * 4 + 3] = Math.round(a * 255);
}
const img = sharp(out, { raw: { width: W, height: H, channels: 4 } });
const trimmed = await img.png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true }));
console.log("full", trimmed.info.width, trimmed.info.height);
await sharp(trimmed.data).png({ compressionLevel: 9 }).toFile("public/brand/logo-dental-arena.png");
await sharp(trimmed.data).resize({ width: 640 }).webp({ quality: 92, alphaQuality: 100 }).toFile("public/brand/logo-dental-arena.webp");
// Mark only: the tooth sits between DENTAL and ARENA, above the wordmark baseline.
const meta = trimmed.info;
// find mark columns: green pixels (g > r + 30)
const raw = await sharp(trimmed.data).raw().toBuffer();
let minX = 1e9, maxX = 0, minY = 1e9, maxY = 0;
for (let y = 0; y < meta.height; y++) for (let x = 0; x < meta.width; x++) {
  const p = (y * meta.width + x) * 4; const r = raw[p], g = raw[p + 1], b = raw[p + 2], a = raw[p + 3];
  if (a > 60 && g > r + 40 && g > b + 10 && x > 700 && x < 1030 && y < 500) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
}
console.log("mark", minX, minY, maxX, maxY);
const pad = 4;
const mark = await sharp(trimmed.data).extract({ left: minX - pad, top: Math.max(0, minY - pad), width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad }).png().toBuffer();
await sharp(mark).toFile("public/brand/semn-dental-arena.png");
// favicon/app icons: mark centred on white
for (const [size, name] of [[180, "apple-touch-icon.png"], [512, "icon-512.png"], [192, "icon-192.png"], [32, "favicon-32.png"]]) {
  const inner = Math.round(size * 0.78);
  const m = await sharp(mark).resize({ height: inner, width: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } }).composite([{ input: m, gravity: "center" }]).png().toFile(name === "apple-touch-icon.png" ? `public/${name}` : `public/brand/${name}`);
}
