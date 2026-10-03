#!/usr/bin/env node
/**
 * Logo v2 — yeni yön önerileri. SVG dosyalarını yazar ve karşılaştırma
 * sayfası (PNG) üretir: her işaret 128 / 32 / 16 px.
 *
 *   node logo/v2/build.mjs
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const require = createRequire(join(root, "app", "package.json"));
const sharp = require("sharp");

const NAVY = "#17305e", BLUE = "#1a5fb4", CYAN = "#0e90d5";
const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY}"/><stop offset="0.55" stop-color="${BLUE}"/><stop offset="1" stop-color="${CYAN}"/></linearGradient></defs>`;
const KARE = `<rect width="32" height="32" rx="9" fill="url(#g)"/>`;
const CIZGI = `stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

/** Her yön: ad, kısa fikir, 32×32 ızgarada gövde. */
export const YONLER = [
  {
    kod: "A",
    ad: "Balon",
    fikir: "Konuşma balonu içinde K — koçum: yanında konuşan biri.",
    govde: `${GRAD}
<path d="M10 3H22A7 7 0 0 1 29 10V18A7 7 0 0 1 22 25H12.5L6.6 30.6L7.3 24.6A7 7 0 0 1 3 18V10A7 7 0 0 1 10 3Z" fill="url(#g)"/>
<g ${CIZGI}><path d="M11.2 8V20"/><path d="M13 14L20.6 7.8"/><path d="M13 14L20.6 20.2"/></g>`,
  },
  {
    kod: "B",
    ad: "Yükseliş",
    fikir: "K'nın üst kolu ok ucuyla biten yükselen çizgi — gelişim, hedef.",
    govde: `${GRAD}${KARE}
<g ${CIZGI}><path d="M10 8V24"/><path d="M11.8 16.5L20.5 24.5"/><path d="M11.8 16.5L22 7.5"/><path d="M16.8 7.5H22V12.7"/></g>`,
  },
  {
    kod: "C",
    ad: "Boynuz",
    fikir: "K'nın üst kolu koç boynuzu gibi içe kıvrılıyor — 'koç' kelime oyunu.",
    govde: `${GRAD}${KARE}
<g ${CIZGI}><path d="M9.5 8V24"/><path d="M11.3 16.5L20 24.5"/><path d="M11.3 16.5C14 13.8 16.2 8.2 21 8.2A3.6 3.6 0 1 1 18.9 14.6" stroke-width="3"/></g>`,
  },
  {
    kod: "D",
    ad: "Kn",
    fikir: "Senin ilk fikrin, rafine: K ve n tek ağırlıkta, n camgöbeği.",
    govde: `${GRAD}${KARE}
<g ${CIZGI}><path d="M8.5 8.5V23.5"/><path d="M10.2 16L15.3 10.8"/><path d="M10.2 16L15.3 21.2"/></g>
<path d="M18.3 23.5V15.2C18.3 13 19.9 11.6 21.9 11.6C23.9 11.6 25.5 13 25.5 15.2V23.5" stroke="#9fd6f7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  {
    kod: "E",
    ad: "Yön",
    fikir: "K'nın kolları ayrık bir ok ucu: ileri, hedefe. 'Koç yön gösterir.'",
    govde: `${GRAD}${KARE}
<g ${CIZGI}><path d="M10 8V24"/><path d="M14.5 9.5L21.5 16L14.5 22.5"/></g>`,
  },
  {
    kod: "F",
    ad: "Onay",
    fikir: "K'nın alt kolu bir onay işareti — Check-up'ın K'sı.",
    govde: `${GRAD}${KARE}
<g ${CIZGI}><path d="M9.5 8V24"/><path d="M11.3 16.5L18.5 9.5"/><path d="M11.3 16.5L16.2 23.2L24.5 12.4"/></g>`,
  },
];


const svg = (y, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="Koçum.Net ${y.ad}">${y.govde}</svg>`;

const outDir = join(here, "svg");
mkdirSync(outDir, { recursive: true });
const ascii = (t) =>
  t.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");
for (const y of YONLER) writeFileSync(join(outDir, `${y.kod}-${ascii(y.ad)}.svg`), svg(y, 32));

// Karşılaştırma sayfası: satır başına bir yön; 128 / 32 / 16 px.
const W = 1200, ROW = 170, PAD = 40;
const H = PAD * 2 + ROW * YONLER.length;
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f4f6fb"/>`;
YONLER.forEach((y, i) => {
  const top = PAD + i * ROW;
  const inner = y.govde.replace(/id="g"/g, `id="g${i}"`).replace(/url\(#g\)/g, `url(#g${i})`);
  const mark = (x, yy, s) => `<svg x="${x}" y="${yy}" width="${s}" height="${s}" viewBox="0 0 32 32">${inner}</svg>`;
  sheet += mark(PAD, top + 10, 128) + mark(PAD + 160, top + 58, 32) + mark(PAD + 212, top + 66, 16);
  // Koyu zemin ve açık zemin tek renk denemesi
  sheet += `<rect x="${PAD + 260}" y="${top + 10}" width="128" height="128" rx="24" fill="${NAVY}"/>` + mark(PAD + 260 + 16, top + 26, 96);
  sheet += `<rect x="${PAD + 410}" y="${top + 10}" width="128" height="128" rx="24" fill="#fff" stroke="#e6eaf2"/>` + mark(PAD + 410 + 16, top + 26, 96);
  sheet += `<text x="${PAD + 580}" y="${top + 62}" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${NAVY}">${y.kod} · ${y.ad}</text>`;
  sheet += `<text x="${PAD + 580}" y="${top + 96}" font-family="Arial, sans-serif" font-size="18" fill="#4b5471">${y.fikir}</text>`;
});
sheet += `</svg>`;

await sharp(Buffer.from(sheet)).png().toFile(join(here, "karsilastirma.png"));
writeFileSync(join(here, "karsilastirma.svg"), sheet);
console.log("yazıldı:", YONLER.map((y) => y.kod).join(", "), "→ logo/v2/svg, karsilastirma.png");

// ─────────────────────────────────────────────────────────────
// Sunum sayfası: her yön gerçek kullanım yerlerinde
// ─────────────────────────────────────────────────────────────

const ONERI = "F";
const NOT = {
  A: {
    arti: "Koç = yanında konuşan biri. Silüeti 16 px'te bile diğer sekmelerden ayrılıyor.",
    risk: "Konuşma balonu mesajlaşma ve destek uygulamalarını çağrıştırıyor.",
  },
  B: {
    arti: "Gelişim fikri anında okunuyor; her boyutta net.",
    risk: "Yükselen ok borsa ve finans logolarında çok yaygın; ayırt edici değil.",
  },
  C: {
    arti: "Koç hem koç hem koç (hayvan): en akılda kalan ve başkasının kullanamayacağı fikir.",
    risk: "Koç burcu (♈) ile karışabilir; ciddi bir sınav markası için oyuncu bulunabilir.",
  },
  D: {
    arti: "Senin ilk fikrin; markanın iki harfi.",
    risk: "İki harf 16 px'te sıkışıyor, sekmede 'n' kayboluyor.",
  },
  E: {
    arti: "En sade ve en güçlü silüet.",
    risk: "Oynat (▶) düğmesi gibi okunuyor; video uygulaması sanılabilir.",
  },
  F: {
    arti: "Her boyutta K okunuyor. Onay işareti hem Check-up ürününü hem 'kontrol testi' ilkesini taşıyor: ana marka ve ürün tek işaret.",
    risk: "Onay işareti tek başına yaygın; K ile birleşimi onu ayırt edici kılıyor.",
  },
};

const sembol = (y) =>
  `<symbol id="m-${y.kod}" viewBox="0 0 32 32">${y.govde
    .replace(/id="g"/g, `id="g-${y.kod}"`)
    .replace(/url\(#g\)/g, `url(#g-${y.kod})`)}</symbol>`;
const kullan = (kod, px) => `<svg width="${px}" height="${px}" aria-hidden="true"><use href="#m-${kod}"/></svg>`;
const wm = (acik) => `<span class="wm${acik ? " acik" : ""}">Koçum<span>.Net</span></span>`;

const kart = (y) => {
  const n = NOT[y.kod];
  const oneri = y.kod === ONERI;
  return `<article class="kart${oneri ? " oneri" : ""}">
  ${oneri ? `<span class="rozet">Önerim</span>` : ""}
  <div class="vitrin">
    <div class="zemin acikz">${kullan(y.kod, 104)}</div>
    <div class="zemin koyuz">${kullan(y.kod, 104)}</div>
  </div>
  <h2>${y.kod} · ${y.ad}</h2>
  <p class="fikir">${y.fikir}</p>
  <div class="mock baslik">${kullan(y.kod, 34)}${wm(false)}<nav>Hizmetler · Blog · İletişim</nav></div>
  <div class="satir">
    <div class="mock sekme">${kullan(y.kod, 16)}<span>Koçum.Net — Sınava kadar aklında</span></div>
    <div class="uyg">${kullan(y.kod, 52)}<small>Koçum.Net</small></div>
  </div>
  <div class="mock altbilgi">${kullan(y.kod, 30)}${wm(true)}</div>
  <dl>
    <div><dt>Artı</dt><dd>${n.arti}</dd></div>
    <div><dt>Risk</dt><dd>${n.risk}</dd></div>
  </dl>
</article>`;
};

const sekmeler = YONLER.map(
  (y) => `<div class="mock sekme dar">${kullan(y.kod, 16)}<span>${y.kod} · ${y.ad}</span></div>`
).join("");

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Koçum.Net · logo yönleri</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700&display=swap">
<style>
  :root { --ink:#111834; --soft:#4b5471; --faint:#6b7392; --line:#e6eaf2; --brand:#1a5fb4; --deep:#17305e; --cyan:#0e90d5; --canvas:#f4f6fb; color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--canvas); color:var(--soft); font:15px/1.6 Inter, system-ui, sans-serif; }
  main { max-width:1180px; margin:0 auto; padding:40px 16px 64px; }
  h1 { font:700 30px/1.15 Poppins, sans-serif; color:var(--ink); margin:0; letter-spacing:-.01em; }
  .giris { max-width:720px; margin:10px 0 0; }
  .test { margin:28px 0 8px; font:600 12px/1 Inter, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--brand); }
  .sekmeler { display:flex; flex-wrap:wrap; gap:8px; }
  .izgara { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:20px; margin-top:28px; }
  .kart { position:relative; background:#fff; border:1px solid var(--line); border-radius:20px; padding:22px; box-shadow:0 1px 3px rgb(17 24 52 / .05); }
  .kart.oneri { border:2px solid var(--brand); box-shadow:0 10px 30px -12px rgb(26 95 180 / .45); }
  .rozet { position:absolute; top:16px; right:16px; background:var(--brand); color:#fff; font:600 12px/1 Inter, sans-serif; padding:6px 10px; border-radius:999px; }
  .vitrin { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .zemin { display:flex; align-items:center; justify-content:center; height:150px; border-radius:16px; }
  .acikz { background:#f6f8fc; border:1px solid var(--line); }
  .koyuz { background:var(--deep); }
  h2 { font:700 20px/1.2 Poppins, sans-serif; color:var(--ink); margin:18px 0 2px; }
  .fikir { margin:0 0 14px; font-size:14px; }
  .mock { display:flex; align-items:center; gap:10px; border:1px solid var(--line); border-radius:12px; background:#fff; }
  .baslik { padding:12px 14px; }
  .baslik nav { margin-left:auto; font-size:12px; color:var(--faint); white-space:nowrap; }
  .wm { font:700 19px/1 Poppins, sans-serif; color:var(--deep); letter-spacing:-.01em; white-space:nowrap; }
  .wm span { color:var(--cyan); }
  .wm.acik { color:#fff; } .wm.acik span { color:#8ecdf5; }
  .satir { display:flex; align-items:center; gap:12px; margin-top:10px; }
  .sekme { flex:1; min-width:0; gap:8px; padding:8px 12px; background:#eef1f7; border-radius:10px 10px 0 0; border-bottom:none; font-size:12px; color:var(--ink); }
  .sekme span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sekme.dar { flex:0 0 auto; border-radius:10px; border-bottom:1px solid var(--line); }
  .uyg { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 12px; border-radius:14px; background:linear-gradient(160deg,#2b3b5c,#121a2e); }
  .uyg small { color:#fff; font-size:10px; }
  .altbilgi { margin-top:10px; padding:12px 14px; background:var(--deep); border-color:var(--deep); }
  dl { margin:14px 0 0; display:grid; gap:8px; font-size:13px; }
  dl div { display:grid; grid-template-columns:44px 1fr; gap:8px; }
  dt { font-weight:600; color:var(--ink); } dd { margin:0; }
  .sprite { position:absolute; width:0; height:0; overflow:hidden; }
</style>
</head>
<body>
<svg class="sprite" aria-hidden="true">${YONLER.map(sembol).join("")}</svg>
<main>
  <h1>Koçum.Net · yeni logo yönleri</h1>
  <p class="giris">Altı yön; her biri sitenin başlığında, tarayıcı sekmesinde, telefon ana ekranında ve koyu altbilgide. Karar verirken üç şeye bak: <strong>16 piksellik sekmede K okunuyor mu</strong>, koyu ve açık zeminde aynı güçte mi, başka bir şeye benziyor mu. Renkler ve yazı tipi aynı kaldı; değişen yalnızca işaret.</p>
  <p class="test">Önce bu: 16 px sekme testi</p>
  <div class="sekmeler">${sekmeler}</div>
  <div class="izgara">${YONLER.map(kart).join("")}</div>
</main>
</body>
</html>`;

writeFileSync(join(here, "sunum.html"), html);
console.log("yazıldı: logo/v2/sunum.html");
