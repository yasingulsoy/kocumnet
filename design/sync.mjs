#!/usr/bin/env node
/**
 * Ortak tasarım dosyalarını üç projeye dağıtır; --check ile eşitliği doğrular.
 *
 *   node design/sync.mjs          kopyala
 *   node design/sync.mjs --check  farklıysa 1 ile çık (CI ve build öncesi)
 *
 * Kaynaklar (yalnızca burada düzenlenir):
 *   design/tokens.css               renk, yazı tipi, ölçek, köşe, gölge
 *   design/brand/brand-paths.ts     logo yol verisi (design/brand/build.mjs üretir)
 *   design/brand/svg|png/...        favicon, uygulama ikonları, e-posta logosu
 *
 * Neden kopya: üç proje ayrı ayrı deploy ediliyor (Dokploy her klasörü kendi
 * başına derliyor), kök dizinde workspace yok. Aynı desen Prisma şeması için
 * admin/scripts/checkup-sync.mjs'te var.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const B = (...p) => join(here, "brand", ...p);

const PROJE = {
  frontend: { app: join(root, "frontend", "app"), lib: join(root, "frontend", "lib"), pub: join(root, "frontend", "public") },
  app: { app: join(root, "app", "app"), lib: join(root, "app", "lib"), pub: join(root, "app", "public") },
  admin: { app: join(root, "admin", "src", "app"), lib: join(root, "admin", "src", "lib"), pub: join(root, "admin", "public") },
};
const hepsi = Object.values(PROJE);

/** [kaynak, hedefler[]] */
const ISLER = [
  [join(here, "tokens.css"), hepsi.map((p) => join(p.app, "tokens.css"))],
  [B("brand-paths.ts"), hepsi.map((p) => join(p.lib, "brand-paths.ts"))],
  // Tarayıcı sekmesi, ana ekran, PWA — Next app/ kuralları + public/icons
  [B("svg", "ikon.svg"), hepsi.map((p) => join(p.app, "icon.svg"))],
  [B("png", "favicon.ico"), hepsi.map((p) => join(p.app, "favicon.ico"))],
  [B("png", "apple-touch-icon-180.png"), hepsi.map((p) => join(p.app, "apple-icon.png"))],
  [B("png", "ikon-192.png"), hepsi.map((p) => join(p.pub, "icons", "icon-192.png"))],
  [B("png", "ikon-512.png"), hepsi.map((p) => join(p.pub, "icons", "icon-512.png"))],
  [B("png", "ikon-maskable-512.png"), hepsi.map((p) => join(p.pub, "icons", "icon-maskable-512.png"))],
  // E-posta başlığı (backend → kocum.net, check-up → kendi alan adı)
  [B("png", "eposta-logo.png"), [join(PROJE.frontend.pub, "brand", "eposta-logo.png"), join(PROJE.app.pub, "brand", "eposta-logo.png")]],
  // Check-up paylaşım görseli (Next dosya kuralı: app/opengraph-image.png)
  [B("sosyal", "og-checkup-1200x630.png"), [join(PROJE.app.app, "opengraph-image.png")]],
  // Basın/indirme için herkese açık logo dosyaları
  [B("svg", "logo-acik.svg"), [join(PROJE.frontend.pub, "brand", "logo-acik.svg")]],
  [B("svg", "logo-koyu.svg"), [join(PROJE.frontend.pub, "brand", "logo-koyu.svg")]],
];

const check = process.argv.includes("--check");
const ad = (p) => relative(root, p).replaceAll("\\", "/");
let farkli = 0;

for (const [kaynak, hedefler] of ISLER) {
  if (!existsSync(kaynak)) {
    console.error(`✗ kaynak yok: ${ad(kaynak)} — önce: cd design && npm install && npm run marka`);
    farkli++;
    continue;
  }
  const veri = readFileSync(kaynak);
  for (const hedef of hedefler) {
    if (check) {
      if (!existsSync(hedef)) {
        console.error(`✗ ${ad(hedef)} yok`);
        farkli++;
      } else if (!readFileSync(hedef).equals(veri)) {
        console.error(`✗ ${ad(hedef)} ${ad(kaynak)}'tan farklı — \`node design/sync.mjs\` çalıştır`);
        farkli++;
      }
      continue;
    }
    mkdirSync(dirname(hedef), { recursive: true });
    copyFileSync(kaynak, hedef);
  }
}

if (check) {
  if (farkli) process.exit(1);
  console.log(`✓ ${ISLER.reduce((n, [, h]) => n + h.length, 0)} kopya güncel`);
} else {
  console.log(`→ ${ISLER.reduce((n, [, h]) => n + h.length, 0)} dosya dağıtıldı`);
}
