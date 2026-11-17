#!/usr/bin/env node
/**
 * Ortak tasarım dosyalarını site ve Check-up uygulamalarına dağıtır; --check ile eşitliği doğrular.
 *
 *   node design/sync.mjs          kopyala
 *   node design/sync.mjs --check  farklıysa 1 ile çık (CI ve build öncesi)
 *
 * Kaynaklar (yalnızca burada düzenlenir):
 *   design/tokens.css               renk, yazı tipi, ölçek, köşe, gölge
 *   design/brand/brand-paths.ts     logo yol verisi (design/brand/build.mjs üretir)
 *   design/brand/svg|png/...        favicon, uygulama ikonları, e-posta logosu
 *   design/tailadmin/               TailAdmin kiti (MIT): theme.css + bileşenler
 *     core     extras/ dışındaki her şey; bağımlılıksız, kit hedefi olan her projeye
 *     extras/  kütüphane isteyen bileşenler; proje başına KIT_HEDEFLERI'nde açılır
 *
 * Neden kopya: projeler ayrı ayrı deploy ediliyor (Dokploy her klasörü kendi
 * başına derliyor), kök dizinde workspace yok.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const B = (...p) => join(here, "brand", ...p);

// Site (frontend/) ve Check-up programının iki Next uygulaması (checkup/frontend,
// checkup/admin). Program backend'i Next değil, buraya girmez.
const yuzey = (...p) => ({ app: join(root, ...p, "app"), lib: join(root, ...p, "lib"), pub: join(root, ...p, "public") });
const PROJE = {
  frontend: yuzey("frontend"),
  checkupFrontend: yuzey("checkup", "frontend"),
  checkupAdmin: yuzey("checkup", "admin"),
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
  // E-posta başlığı (site backend'i → kocum.net, program backend'i → öğrenci uygulamasının alan adı)
  [B("png", "eposta-logo.png"), [join(PROJE.frontend.pub, "brand", "eposta-logo.png"), join(PROJE.checkupFrontend.pub, "brand", "eposta-logo.png")]],
  // Check-up paylaşım görseli (Next dosya kuralı: app/opengraph-image.png)
  [B("sosyal", "og-checkup-1200x630.png"), [join(PROJE.checkupFrontend.app, "opengraph-image.png")]],
  // Basın/indirme için herkese açık logo dosyaları
  [B("svg", "logo-acik.svg"), [join(PROJE.frontend.pub, "brand", "logo-acik.svg")]],
  [B("svg", "logo-koyu.svg"), [join(PROJE.frontend.pub, "brand", "logo-koyu.svg")]],
];

// ─── TailAdmin kiti ───────────────────────────────────────────

const KIT = join(here, "tailadmin");

/**
 * Eklentiler: design/tailadmin/extras/<ad>/. Bir projede açılınca o
 * projenin package.json'unda bağımlılıklar bulunmalı (--check denetler).
 */
const EKLENTILER = {
  dropzone: { bagimliliklar: ["react-dropzone"] },
  datepicker: { bagimliliklar: ["flatpickr"] },
  // ApexCharts MIT değil: topluluk lisansı, yıllık geliri 2 milyon USD altındaki
  // kuruluşlar için ücretsiz. Ürün sahibi 10 Ekim 2026'da onayladı.
  charts: { bagimliliklar: ["apexcharts", "react-apexcharts"] },
};

/**
 * Kit hedefleri: css (theme.css'in yeri), dizin (bileşenlerin yeri), paket
 * ve açılacak eklentiler. Site: dosya yükleme (blog görseli) ve grafikler
 * (ApexCharts; yalnızca grafik kullanan sayfalar yükler). Check-up uygulamaları
 * yalnızca bağımlılıksız çekirdek kiti kullanır (yükleme düz <input type=file>).
 */
const KIT_HEDEFLERI = {
  frontend: {
    css: join(PROJE.frontend.app, "tailadmin.css"),
    dizin: join(root, "frontend", "components", "tailadmin"),
    paket: join(root, "frontend", "package.json"),
    eklentiler: ["dropzone", "charts"],
  },
  checkupFrontend: {
    css: join(PROJE.checkupFrontend.app, "tailadmin.css"),
    dizin: join(root, "checkup", "frontend", "components", "tailadmin"),
    paket: join(root, "checkup", "frontend", "package.json"),
    eklentiler: [],
  },
  checkupAdmin: {
    css: join(PROJE.checkupAdmin.app, "tailadmin.css"),
    dizin: join(root, "checkup", "admin", "components", "tailadmin"),
    paket: join(root, "checkup", "admin", "package.json"),
    eklentiler: [],
  },
};

/** Dizindeki bütün dosyalar (göreli yol, / ayraçlı). */
function dosyalar(dizin, onek = "") {
  if (!existsSync(dizin)) return [];
  const sonuc = [];
  for (const ad of readdirSync(dizin).sort()) {
    const tam = join(dizin, ad);
    const gor = onek ? `${onek}/${ad}` : ad;
    if (statSync(tam).isDirectory()) sonuc.push(...dosyalar(tam, gor));
    else sonuc.push(gor);
  }
  return sonuc;
}

/** Kitin core dosyaları: README, theme.css ve extras/ hariç her şey. */
const CORE = dosyalar(KIT).filter((f) => f !== "README.md" && f !== "theme.css" && !f.startsWith("extras/"));

const fazlaDosyalar = [];
const eksikBagimliliklar = [];

for (const [proje, h] of Object.entries(KIT_HEDEFLERI)) {
  ISLER.push([join(KIT, "theme.css"), [h.css]]);
  const beklenen = new Set();
  for (const f of CORE) {
    ISLER.push([join(KIT, ...f.split("/")), [join(h.dizin, ...f.split("/"))]]);
    beklenen.add(f);
  }
  const paket = existsSync(h.paket) ? JSON.parse(readFileSync(h.paket, "utf8")) : {};
  const kurulu = { ...paket.dependencies, ...paket.devDependencies };
  for (const ad of h.eklentiler) {
    const ek = EKLENTILER[ad];
    if (!ek) throw new Error(`Bilinmeyen eklenti: ${ad} (${proje})`);
    for (const f of dosyalar(join(KIT, "extras", ad))) {
      const gor = `extras/${ad}/${f}`;
      ISLER.push([join(KIT, ...gor.split("/")), [join(h.dizin, ...gor.split("/"))]]);
      beklenen.add(gor);
    }
    for (const b of ek.bagimliliklar) if (!kurulu[b]) eksikBagimliliklar.push(`${proje}: "${ad}" eklentisi ${b} ister — cd ${proje} && npx npm@10.9.4 install ${b}`);
  }
  // Kaynakta olmayan kopya (yeniden adlandırılmış ya da kapatılmış eklenti) kalmasın.
  for (const f of dosyalar(h.dizin)) if (!beklenen.has(f)) fazlaDosyalar.push(join(h.dizin, ...f.split("/")));
}

// ─── Çalıştır ─────────────────────────────────────────────────

const check = process.argv.includes("--check");
const ad = (p) => relative(root, p).split(sep).join("/");
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

for (const f of fazlaDosyalar) {
  if (check) {
    console.error(`✗ ${ad(f)} kitte yok (eski kopya) — \`node design/sync.mjs\` siler`);
    farkli++;
  } else {
    rmSync(f);
    console.log(`  silindi: ${ad(f)} (kitte yok)`);
  }
}

for (const e of eksikBagimliliklar) {
  console.error(`✗ ${e}`);
  if (check) farkli++;
}

const toplam = ISLER.reduce((n, [, h]) => n + h.length, 0);
if (check) {
  if (farkli) process.exit(1);
  console.log(`✓ ${toplam} kopya güncel`);
} else {
  console.log(`→ ${toplam} dosya dağıtıldı`);
}
