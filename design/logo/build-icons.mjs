#!/usr/bin/env node
/**
 * Marka işaretinden (mark.svg) üç projenin ikon dosyalarını üretir.
 *
 *   node design/logo/build-icons.mjs
 *
 * sharp'ı app/node_modules'den ödünç alıyor (kök dizinde node_modules yok).
 *
 * Üretilenler:
 *   frontend/app/icon.svg                 tarayıcı sekmesi (vektör)
 *   frontend/app/apple-icon.png           180×180, tam dolu kare (iOS köşeyi kendi yuvarlar)
 *   frontend/public/icons/icon-192.png    PWA
 *   frontend/public/icons/icon-512.png    PWA
 *   frontend/public/icons/icon-maskable-512.png  Android adaptive: işaret %80, güvenli alan
 *   app/app/icon.svg, app/app/apple-icon.png
 *   admin/src/app/icon.svg, admin/src/app/apple-icon.png
 *
 * Neden ayrı 16px favicon yok: Next `icon.svg`'yi her boyutta kullanır ve
 * modern tarayıcılar SVG favicon'u destekler. 16px için ayrı çizim
 * (favicon-16.svg) elde duruyor, gerekirse `icon.svg` yerine konur.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const require = createRequire(join(root, "app", "package.json"));
const sharp = require("sharp");

const NAVY = "#17305e";
const BLUE = "#1a5fb4";
const CYAN = "#0e90d5";

/** K işareti — 32 birimlik ızgarada çizildi; her yerde aynı yollar. */
const K_PATHS = `
  <g stroke="#ffffff" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M11 8.8 V 23.2" />
    <path d="M12.8 16 L 21.4 23.2" />
    <path d="M12.8 16 L 19.8 10.2" />
  </g>
  <circle cx="22.4" cy="8.6" r="2.4" fill="#ffffff" />`;

const GRADIENT = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}" />
      <stop offset="0.55" stop-color="${BLUE}" />
      <stop offset="1" stop-color="${CYAN}" />
    </linearGradient>
  </defs>`;

/**
 * @param {object} o
 * @param {number} o.size      çıktı piksel boyutu
 * @param {number} [o.radius]  köşe yarıçapı (32'lik ızgarada); 0 = tam dolu kare
 * @param {number} [o.scale]   işaretin kareye oranı (maskable için 0.8)
 */
function svg({ size, radius = 9, scale = 1 }) {
  const off = (32 - 32 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  ${GRADIENT}
  <rect width="32" height="32" rx="${radius}" fill="url(#g)" />
  <g transform="translate(${off} ${off}) scale(${scale})">${K_PATHS}</g>
</svg>`;
}

/** Vektör favicon: Next bunu doğrudan servis eder. */
const ICON_SVG = svg({ size: 512 });

async function png(markup, out) {
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(markup)).png({ compressionLevel: 9 }).toFile(out);
  console.log("→", out.replace(root, "").replaceAll("\\", "/"));
}

function write(out, content) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content);
  console.log("→", out.replace(root, "").replaceAll("\\", "/"));
}

const projeler = [
  { app: join(root, "frontend", "app"), pub: join(root, "frontend", "public") },
  { app: join(root, "app", "app"), pub: join(root, "app", "public") },
  { app: join(root, "admin", "src", "app"), pub: join(root, "admin", "public") },
];

for (const p of projeler) {
  write(join(p.app, "icon.svg"), ICON_SVG);
  // iOS köşeyi kendisi yuvarlar; şeffaf köşe siyah görünür → tam dolu kare.
  await png(svg({ size: 180, radius: 0 }), join(p.app, "apple-icon.png"));
  await png(svg({ size: 192 }), join(p.pub, "icons", "icon-192.png"));
  await png(svg({ size: 512 }), join(p.pub, "icons", "icon-512.png"));
  // Maskable: Android ikonun %10'luk kenarını kırpabilir; işaret %80'e çekildi.
  await png(svg({ size: 512, radius: 0, scale: 0.8 }), join(p.pub, "icons", "icon-maskable-512.png"));
}

console.log("bitti");
