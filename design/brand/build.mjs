#!/usr/bin/env node
/**
 * Koçum.Net marka kiti üreticisi — "Fosfor" logosu.
 *
 *   cd design && npm install      (bir kez: opentype.js + sharp)
 *   npm run marka                 (bu betik)
 *   cd .. && node design/sync.mjs (projelere dağıt)
 *
 * Logo yazısı Baloo 2 ExtraBold'dan ÇİZGİYE çevrilir: hiçbir ortamda yazı
 * tipine bağımlı değil. Fosforlu kalem şekli, seçilen sunumdaki CSS'in
 * (logo/v3) birebir geometrisi: "net"in kutusundan .06em sola, .08em sağa
 * taşar, -2.5° döner.
 *
 * Çıktılar:
 *   svg/      logo (açık, koyu, tek renk), sloganlı logo, ikon varyantları
 *   png/      her varyantın 256-2048 genişlikleri, ikon 16-1024, favicon.ico
 *   sosyal/   Open Graph, profil fotoğrafı, kapak görselleri
 *   brand-paths.ts  React bileşenlerinin kullandığı yol verisi (sync ile kopyalanır)
 */
import opentype from "opentype.js";
import sharp from "sharp";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FONTS = join(here, "..", "fonts");

export const RENK = {
  ink: "#14213d", // lacivert — logo yazısı
  sari: "#ffd43b", // fosforlu sarı — yalnızca vurgu
  beyaz: "#ffffff",
  kagit: "#fffdf6",
  griAcik: "#5b6478", // slogan, açık zemin
  griKoyu: "#c3cad8", // slogan, koyu zemin
};

const baloo = opentype.loadSync(join(FONTS, "Baloo2-ExtraBold.ttf"));
const inter = opentype.loadSync(join(FONTS, "Inter-SemiBold.ttf"));
const poppins = opentype.loadSync(join(FONTS, "Poppins-Bold.ttf"));
const F = 100; // tasarım ölçeği: 1em = 100 birim

const r2 = (n) => Math.round(n * 100) / 100;
const birlesik = (a, b) => ({
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
  x2: Math.max(a.x2, b.x2),
  y2: Math.max(a.y2, b.y2),
});
const BOS = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };

// ─────────────────────────────────────────────────────────────
// Yazı logosu geometrisi
// ─────────────────────────────────────────────────────────────

/**
 * "koçum.net" glif glif dizilir. Sunumdaki CSS'le aynı: letter-spacing
 * -.02em, "net" işaretli (mark) ve .04em iç boşluklu.
 */
function dizilim(dx = 0, dy = 0) {
  const metin = "koçum.net";
  const glifler = baloo.stringToGlyphs(metin);
  const olcek = F / baloo.unitsPerEm;
  const LS = -0.02 * F;
  let x = dx;
  const koc = [];
  const net = [];
  let netBas = 0;
  let netSon = 0;
  glifler.forEach((g, i) => {
    if (i === 6) {
      netBas = x;
      x += 0.04 * F;
    }
    (i < 6 ? koc : net).push(g.getPath(x, dy, F));
    x += g.advanceWidth * olcek + LS;
    if (i < glifler.length - 1) x += baloo.getKerningValue(g, glifler[i + 1]) * olcek;
    if (i === glifler.length - 1) {
      x += 0.04 * F;
      netSon = x;
    }
  });
  return { koc, net, netBas, netSon };
}

/** Fosforlu kalem şekli: 200×60 kutudaki düzensiz dörtgen, kutuya oturtulup döndürülür. */
const KALEM = [
  ["M", [6, 14]],
  ["C", [50, 6], [120, 11], [196, 4]],
  ["L", [198, 50]],
  ["C", [140, 57], [70, 51], [2, 57]],
];

function kalemYolu(netBas, netSon, dy) {
  // Kutu: CSS'teki mark::before — içerik alanının üstünden .3em aşağı,
  // altından .12em yukarı. Baloo 2'nin içerik alanı: ascender 1.078em,
  // descender .524em (hhea).
  const asc = baloo.ascender / baloo.unitsPerEm;
  const desc = -baloo.descender / baloo.unitsPerEm;
  // Sunumda -.06em idi; tek renk sürümde nokta kaleme yapışıyordu. -.02em
  // noktaya nefes payı bırakıyor, renkli sürümde fark gözle seçilmiyor.
  const L = netBas - 0.02 * F;
  const R = netSon + 0.08 * F;
  const T = dy - (asc - 0.3) * F;
  const B = dy + (desc - 0.12) * F;
  return kalemKutuya(L, T, R, B, -2.5);
}

/** KALEM şeklini (L,T)-(R,B) kutusuna oturtur ve kutunun merkezinde döndürür. */
function kalemKutuya(L, T, R, B, derece) {
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  const aci = (derece * Math.PI) / 180;
  const cos = Math.cos(aci);
  const sin = Math.sin(aci);
  const nokta = ([u, v]) => {
    const x = L + (u / 200) * (R - L);
    const y = T + (v / 60) * (B - T);
    return [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
  };
  let d = "";
  let kutu = BOS;
  for (const [komut, ...pts] of KALEM) {
    const donmus = pts.map(nokta);
    for (const [x, y] of donmus) kutu = birlesik(kutu, { x1: x, y1: y, x2: x, y2: y });
    d += komut + donmus.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(" ");
  }
  return { d: d + "Z", kutu };
}

const yolVerisi = (yollar) => yollar.map((p) => p.toPathData(2)).join("");
const yolKutusu = (yollar) => yollar.map((p) => p.getBoundingBox()).reduce(birlesik, BOS);

/** Kenar boşluğu: kenar yumuşatması kırpılmasın diye çok küçük. */
const PAY = 0.03 * F;

function yaziLogosu() {
  // 1. tur: kutuyu ölç
  const on = dizilim();
  const kalem0 = kalemYolu(on.netBas, on.netSon, 0);
  const kutu = [yolKutusu(on.koc), yolKutusu(on.net), kalem0.kutu].reduce(birlesik);
  // 2. tur: (0,0)'dan başlayacak şekilde yeniden diz
  const dx = PAY - kutu.x1;
  const dy = PAY - kutu.y1;
  const son = dizilim(dx, dy);
  const kalem = kalemYolu(son.netBas, son.netSon, dy);
  const gen = r2(kutu.x2 - kutu.x1 + 2 * PAY);
  const yuk = r2(kutu.y2 - kutu.y1 + 2 * PAY);
  return {
    gen,
    yuk,
    taban: r2(dy), // yazının taban çizgisi
    kocSol: r2(yolKutusu(son.koc).x1),
    koc: yolVerisi(son.koc),
    net: yolVerisi(son.net),
    kalem: kalem.d,
  };
}

const W = yaziLogosu();

// ─────────────────────────────────────────────────────────────
// Varyantlar
// ─────────────────────────────────────────────────────────────

/**
 * ton: "acik" (açık zemin: lacivert yazı) · "koyu" (koyu zemin: beyaz yazı)
 *      "tek-lacivert" · "tek-beyaz" (tek renk baskı: "net" kalemden oyulur)
 */
function logoIcerik(ton, maskeId = "net-oyuk") {
  if (ton === "tek-lacivert" || ton === "tek-beyaz") {
    const renk = ton === "tek-lacivert" ? RENK.ink : RENK.beyaz;
    return `<defs><mask id="${maskeId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W.gen}" height="${W.yuk}"><rect width="${W.gen}" height="${W.yuk}" fill="#fff"/><path d="${W.net}" fill="#000"/></mask></defs>
<path d="${W.kalem}" fill="${renk}" mask="url(#${maskeId})"/><path d="${W.koc}" fill="${renk}"/>`;
  }
  const yazi = ton === "koyu" ? RENK.beyaz : RENK.ink;
  return `<path d="${W.kalem}" fill="${RENK.sari}"/><path d="${W.koc}" fill="${yazi}"/><path d="${W.net}" fill="${RENK.ink}"/>`;
}

const svgKok = (vb, icerik, { gen, yuk, baslik = "Koçum.Net", zemin } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${gen ? ` width="${gen}"` : ""}${yuk ? ` height="${yuk}"` : ""} role="img" aria-label="${baslik}">${zemin ? `<rect width="100%" height="100%" fill="${zemin}"/>` : ""}${icerik}</svg>`;

const logoSvg = (ton, o = {}) => svgKok(`0 0 ${W.gen} ${W.yuk}`, logoIcerik(ton), o);

/** Sloganlı kilitlenme: logo + "sınava kadar aklında" (Inter SemiBold, çizgi). */
const SLOGAN = "sınava kadar aklında";
function sloganli(ton) {
  const boy = 0.235 * F;
  const bosluk = 0.34 * F;
  const y = W.yuk + bosluk;
  const yol = inter.getPath(SLOGAN, W.kocSol + 0.02 * F, y, boy);
  const k = yol.getBoundingBox();
  const gen = r2(Math.max(W.gen, k.x2 + PAY));
  const yuk = r2(k.y2 + PAY);
  const renk = ton === "koyu" || ton === "tek-beyaz" ? (ton === "koyu" ? RENK.griKoyu : RENK.beyaz) : ton === "tek-lacivert" ? RENK.ink : RENK.griAcik;
  return { gen, yuk, icerik: logoIcerik(ton, `net-oyuk-s`) + `<path d="${yol.toPathData(2)}" fill="${renk}"/>` };
}

// ─────────────────────────────────────────────────────────────
// İkon (monogram "k")
// ─────────────────────────────────────────────────────────────

function kHarfi(hedefYukseklik, merkezX, merkezY) {
  const g = baloo.charToGlyph("k");
  const deneme = g.getPath(0, 0, F).getBoundingBox();
  const boy = (F * hedefYukseklik) / (deneme.y2 - deneme.y1);
  const olcu = g.getPath(0, 0, boy).getBoundingBox();
  const x = merkezX - (olcu.x1 + olcu.x2) / 2;
  const y = merkezY - (olcu.y1 + olcu.y2) / 2;
  return g.getPath(x, y, boy).toPathData(2);
}

const IKON = { boyut: 64, yaricap: 14, k: kHarfi(36, 32, 32.6), kGuvenli: kHarfi(29, 32, 32.5) };

/** zemin: "sari" (birincil) · "lacivert" (koyu alternatif) ; kose: yuvarlak mı, tam kare mi */
function ikonSvg({ zemin = "sari", kose = true, guvenli = false, gen, yuk } = {}) {
  const arka = zemin === "sari" ? RENK.sari : RENK.ink;
  const harf = zemin === "sari" ? RENK.ink : RENK.sari;
  const rx = kose ? IKON.yaricap : 0;
  return svgKok(
    "0 0 64 64",
    `<rect width="64" height="64" rx="${rx}" fill="${arka}"/><path d="${guvenli ? IKON.kGuvenli : IKON.k}" fill="${harf}"/>`,
    { gen, yuk }
  );
}

// ─────────────────────────────────────────────────────────────
// Sosyal medya ve e-posta görselleri
// ─────────────────────────────────────────────────────────────

/** Ortalanmış kilitlenme: hedef genişlikte, tuvalin ortasında. */
function ortala({ tuvalGen, tuvalYuk, zemin, ton, logoGen, slogan = true }) {
  const s = slogan ? sloganli(ton) : { gen: W.gen, yuk: W.yuk, icerik: logoIcerik(ton, "net-oyuk-o") };
  const olcek = logoGen / s.gen;
  const x = (tuvalGen - s.gen * olcek) / 2;
  const y = (tuvalYuk - s.yuk * olcek) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tuvalGen}" height="${tuvalYuk}" viewBox="0 0 ${tuvalGen} ${tuvalYuk}"><rect width="100%" height="100%" fill="${zemin}"/><g transform="translate(${r2(x)} ${r2(y)}) scale(${olcek.toFixed(5)})">${s.icerik}</g></svg>`;
}

/**
 * Check-up uygulamasının paylaşım görseli (WhatsApp, X, LinkedIn önizlemesi).
 * Başlık uygulamanın açılış sayfasıyla aynı; ikinci satır fosforlu kalemle
 * çizili, sitedeki .marker gibi. Yazılar çizgiye çevrili: tarayıcı/font yok.
 */
function checkupOg() {
  const TG = 1200;
  const TY = 630;
  const X = 84;
  const enFazla = TG - 2 * X;
  let icerik = "";

  // Logo + "MATEMATİK CHECK-UP" etiketi (uygulamadaki Wordmark gibi)
  const logoGen = 300;
  const lo = logoGen / W.gen;
  const logoY = 74;
  icerik += `<g transform="translate(${X} ${logoY}) scale(${lo.toFixed(5)})">${logoIcerik("acik", "net-oyuk-c")}</g>`;
  const eBoy = 18;
  const ePay = 15;
  const eYuk = 38;
  const eYol = inter.getPath("MATEMATİK CHECK-UP", 0, 0, eBoy, { letterSpacing: 0.12 });
  const ek = eYol.getBoundingBox();
  const eX = X + logoGen + 24;
  const eOrta = logoY + (W.taban * lo) - 0.27 * F * lo; // yazının x-yüksekliği ortası
  const eY = eOrta - eYuk / 2;
  const eYazi = inter.getPath("MATEMATİK CHECK-UP", eX + ePay - ek.x1, eOrta - (ek.y1 + ek.y2) / 2, eBoy, { letterSpacing: 0.12 });
  icerik += `<rect x="${r2(eX)}" y="${r2(eY)}" width="${r2(ek.x2 - ek.x1 + 2 * ePay)}" height="${eYuk}" rx="9" fill="#eceef3"/><path d="${eYazi.toPathData(2)}" fill="#4b5471"/>`;

  // Başlık: Poppins Bold, ikinci satır kalemin üstünde
  const bBoy = 76;
  const ls = { letterSpacing: -0.02 };
  const y1 = 300;
  const y2 = y1 + Math.round(bBoy * 1.13);
  const s1 = poppins.getPath("Net kaç değil,", X, y1, bBoy, ls);
  const s2 = poppins.getPath("nerede eksiğin var?", X, y2, bBoy, ls);
  const k2 = s2.getBoundingBox();
  const kalem = kalemKutuya(k2.x1 - 0.12 * bBoy, y2 - 0.68 * bBoy, k2.x2 + 0.14 * bBoy, y2 + 0.22 * bBoy, -1.2);
  icerik += `<path d="${kalem.d}" fill="${RENK.sari}"/><path d="${s1.toPathData(2)}${s2.toPathData(2)}" fill="${RENK.ink}"/>`;

  // Alt satır: sığmazsa küçülür
  const altMetin = "20 dakikalık bir testle hangi konuda zayıf olduğunu gör.";
  let aBoy = 30;
  while (inter.getAdvanceWidth(altMetin, aBoy) > enFazla && aBoy > 20) aBoy -= 1;
  const alt = inter.getPath(altMetin, X, y2 + 78, aBoy);
  icerik += `<path d="${alt.toPathData(2)}" fill="${RENK.griAcik}"/>`;

  // Alt bilgi
  const adres = inter.getPath("checkup.kocum.net", X, TY - 66, 23);
  icerik += `<path d="${adres.toPathData(2)}" fill="${RENK.griAcik}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TG}" height="${TY}" viewBox="0 0 ${TG} ${TY}"><rect width="100%" height="100%" fill="${RENK.kagit}"/>${icerik}</svg>`;
}

function profil(boyut) {
  // Daire kırpmaya dayanıklı: "k" tuvalin %46'sı, tam kare sarı zemin.
  const k = kHarfi(boyut * 0.46, boyut / 2, boyut / 2 + boyut * 0.008);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 ${boyut} ${boyut}"><rect width="100%" height="100%" fill="${RENK.sari}"/><path d="${k}" fill="${RENK.ink}"/></svg>`;
}

// ─────────────────────────────────────────────────────────────
// favicon.ico (PNG gömülü, 16/32/48)
// ─────────────────────────────────────────────────────────────

function ico(pngler) {
  const baslik = Buffer.alloc(6);
  baslik.writeUInt16LE(0, 0);
  baslik.writeUInt16LE(1, 2);
  baslik.writeUInt16LE(pngler.length, 4);
  const girdiler = [];
  let ofset = 6 + 16 * pngler.length;
  for (const { boyut, veri } of pngler) {
    const e = Buffer.alloc(16);
    e.writeUInt8(boyut >= 256 ? 0 : boyut, 0);
    e.writeUInt8(boyut >= 256 ? 0 : boyut, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(veri.length, 8);
    e.writeUInt32LE(ofset, 12);
    ofset += veri.length;
    girdiler.push(e);
  }
  return Buffer.concat([baslik, ...girdiler, ...pngler.map((p) => p.veri)]);
}

// ─────────────────────────────────────────────────────────────
// Yazdır
// ─────────────────────────────────────────────────────────────

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
const yaz = (yol, veri) => {
  mkdirSync(dirname(yol), { recursive: true });
  writeFileSync(yol, veri);
};

for (const d of ["svg", "png", "sosyal"]) rmSync(join(here, d), { recursive: true, force: true });

const LOGOLAR = ["acik", "koyu", "tek-lacivert", "tek-beyaz"];
const GENISLIKLER = [256, 512, 1024, 2048];
let sayac = 0;

for (const ton of LOGOLAR) {
  yaz(join(here, "svg", `logo-${ton}.svg`), logoSvg(ton));
  sayac++;
  for (const g of GENISLIKLER) {
    const y = Math.round((g * W.yuk) / W.gen);
    yaz(join(here, "png", `logo-${ton}-${g}.png`), await png(logoSvg(ton, { gen: g, yuk: y })));
    sayac++;
  }
  const s = sloganli(ton);
  yaz(join(here, "svg", `logo-slogan-${ton}.svg`), svgKok(`0 0 ${s.gen} ${s.yuk}`, s.icerik));
  sayac++;
  for (const g of [512, 1024, 2048]) {
    const y = Math.round((g * s.yuk) / s.gen);
    yaz(join(here, "png", `logo-slogan-${ton}-${g}.png`), await png(svgKok(`0 0 ${s.gen} ${s.yuk}`, s.icerik, { gen: g, yuk: y })));
    sayac++;
  }
}

// Uyarlanır: tek dosya, sistemin açık/koyu moduna göre "koçum." lacivert ya
// da beyaz olur (<img>, GitHub, Notion). Kalem ve "net" iki modda aynı.
// E-posta istemcileri SVG ve medya sorgusunu desteklemez: orada PNG.
yaz(
  join(here, "svg", "logo-otomatik.svg"),
  svgKok(
    `0 0 ${W.gen} ${W.yuk}`,
    `<style>.koc{fill:${RENK.ink}}@media (prefers-color-scheme:dark){.koc{fill:${RENK.beyaz}}}</style><path d="${W.kalem}" fill="${RENK.sari}"/><path class="koc" d="${W.koc}"/><path d="${W.net}" fill="${RENK.ink}"/>`
  )
);
sayac++;

// İkonlar
yaz(join(here, "svg", "ikon.svg"), ikonSvg());
yaz(join(here, "svg", "ikon-lacivert.svg"), ikonSvg({ zemin: "lacivert" }));
yaz(join(here, "svg", "ikon-kare.svg"), ikonSvg({ kose: false }));
yaz(join(here, "svg", "ikon-maskable.svg"), ikonSvg({ kose: false, guvenli: true }));
sayac += 4;
for (const b of [16, 32, 48, 64, 128, 192, 256, 512, 1024]) {
  yaz(join(here, "png", `ikon-${b}.png`), await png(ikonSvg({ gen: b, yuk: b })));
  yaz(join(here, "png", `ikon-lacivert-${b}.png`), await png(ikonSvg({ zemin: "lacivert", gen: b, yuk: b })));
  sayac += 2;
}
yaz(join(here, "png", "apple-touch-icon-180.png"), await png(ikonSvg({ kose: false, gen: 180, yuk: 180 })));
yaz(join(here, "png", "ikon-maskable-512.png"), await png(ikonSvg({ kose: false, guvenli: true, gen: 512, yuk: 512 })));
const favPng = await Promise.all([16, 32, 48].map(async (b) => ({ boyut: b, veri: await png(ikonSvg({ gen: b, yuk: b })) })));
yaz(join(here, "png", "favicon.ico"), ico(favPng));
sayac += 3;

// Sosyal medya
const SOSYAL = [
  ["og-1200x630-acik.png", ortala({ tuvalGen: 1200, tuvalYuk: 630, zemin: RENK.kagit, ton: "acik", logoGen: 760 })],
  ["og-1200x630-koyu.png", ortala({ tuvalGen: 1200, tuvalYuk: 630, zemin: RENK.ink, ton: "koyu", logoGen: 760 })],
  ["kapak-x-1500x500.png", ortala({ tuvalGen: 1500, tuvalYuk: 500, zemin: RENK.ink, ton: "koyu", logoGen: 720 })],
  ["kapak-linkedin-1584x396.png", ortala({ tuvalGen: 1584, tuvalYuk: 396, zemin: RENK.ink, ton: "koyu", logoGen: 640 })],
  ["og-checkup-1200x630.png", checkupOg()],
  ["profil-1080.png", profil(1080)],
  ["profil-400.png", profil(400)],
];
for (const [ad, svg] of SOSYAL) {
  yaz(join(here, "sosyal", ad), await png(svg));
  sayac++;
}

// Önizleme: kitin tek bakışta görüntüsü (README'de gösterilir)
function onizleme() {
  const TG = 1600;
  const TY = 900;
  const P = 48;
  const A = 24;
  const yarim = (TG - 2 * P - A) / 2;
  const acikZemin = (z) => z === RENK.beyaz || z === RENK.kagit;
  const panel = (x, y, g, h, zemin, ic) =>
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(g)}" height="${r2(h)}" rx="22" fill="${zemin}"${acikZemin(zemin) ? ' stroke="#e6e8ee"' : ""}/>${ic}`;
  const logo = (ton, x, y, g, h, gen, id) => {
    const o = gen / W.gen;
    return `<g transform="translate(${r2(x + (g - gen) / 2)} ${r2(y + (h - W.yuk * o) / 2)}) scale(${o.toFixed(5)})">${logoIcerik(ton, id)}</g>`;
  };
  const yazi = (metin, x, y, boy, renk) => `<path d="${inter.getPath(metin, x, y, boy).toPathData(2)}" fill="${renk}"/>`;
  const ikon = (x, y, boyut, zemin, harf, k = IKON.k, rx = IKON.yaricap) =>
    `<g transform="translate(${r2(x)} ${r2(y)}) scale(${(boyut / 64).toFixed(5)})"><rect width="64" height="64" rx="${rx}" fill="${zemin}"/><path d="${k}" fill="${harf}"/></g>`;
  const sag = P + yarim + A;
  let svg = "";

  // 1. satır: renkli logolar, açık ve koyu zemin
  const y1 = P;
  const h1 = 300;
  svg += panel(P, y1, yarim, h1, RENK.beyaz, logo("acik", P, y1, yarim, h1, 500, "o1"));
  svg += panel(sag, y1, yarim, h1, RENK.ink, logo("koyu", sag, y1, yarim, h1, 500, "o2"));

  // 2. satır: tek renk
  const y2 = y1 + h1 + A;
  const h2 = 220;
  svg += panel(P, y2, yarim, h2, RENK.kagit, logo("tek-lacivert", P, y2, yarim, h2, 380, "o3"));
  svg += panel(sag, y2, yarim, h2, RENK.ink, logo("tek-beyaz", sag, y2, yarim, h2, 380, "o4"));

  // 3. satır: ikonlar ve renkler
  const y3 = y2 + h2 + A;
  const h3 = TY - P - y3;
  const iy = y3 + (h3 - 140) / 2;
  let ik = ikon(P + 40, iy, 140, RENK.sari, RENK.ink) + ikon(P + 204, iy, 140, RENK.ink, RENK.sari);
  ik += `<defs><clipPath id="daire"><circle cx="${P + 438}" cy="${r2(iy + 70)}" r="70"/></clipPath></defs><g clip-path="url(#daire)">${ikon(P + 368, iy, 140, RENK.sari, RENK.ink, IKON.kGuvenli, 0)}</g>`;
  ik += ikon(P + 540, iy + 76, 64, RENK.sari, RENK.ink) + ikon(P + 620, iy + 108, 32, RENK.sari, RENK.ink) + ikon(P + 668, iy + 124, 16, RENK.sari, RENK.ink);
  svg += panel(P, y3, yarim, h3, RENK.beyaz, ik);

  const renkler = [
    ["Lacivert", "#14213D", RENK.ink],
    ["Fosfor", "#FFD43B", RENK.sari],
    ["Kâğıt", "#FFFDF6", RENK.kagit],
    ["Arayüz mavisi", "#1A5FB4", "#1a5fb4"],
  ];
  const sw = 150;
  const sh = 110;
  const sg = (yarim - 64 - 4 * sw) / 3;
  let rk = "";
  renkler.forEach(([ad, hex, renk], i) => {
    const x = sag + 32 + i * (sw + sg);
    const y = y3 + 36;
    rk += `<rect x="${r2(x)}" y="${y}" width="${sw}" height="${sh}" rx="14" fill="${renk}" stroke="#e6e8ee"/>`;
    rk += yazi(ad, x + 2, y + sh + 34, 20, RENK.ink) + yazi(hex, x + 2, y + sh + 62, 17, RENK.griAcik);
  });
  svg += panel(sag, y3, yarim, h3, RENK.beyaz, rk);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TG}" height="${TY}" viewBox="0 0 ${TG} ${TY}"><rect width="100%" height="100%" fill="#f6f6f3"/>${svg}</svg>`;
}
yaz(join(here, "onizleme.png"), await png(onizleme()));
sayac++;

// E-posta: beyaz zeminli (koyu mod istemcileri saydam PNG'yi koyu zemine
// basınca lacivert yazı kayboluyor). Gösterim genişliği 160 px, 2× çözünürlük.
const EPOSTA_GEN = 320;
const epostaYuk = Math.round((EPOSTA_GEN * W.yuk) / W.gen);
yaz(join(here, "png", "eposta-logo.png"), await png(logoSvg("acik", { gen: EPOSTA_GEN, yuk: epostaYuk, zemin: RENK.beyaz })));
sayac++;

// React bileşenleri için yol verisi
const TS = `/**
 * ⚠️ OTOMATİK ÜRETİLDİ — design/brand/build.mjs. ELLE DÜZENLEME.
 * Koçum.Net marka kiti ("Fosfor"). Dağıtım: node design/sync.mjs
 *
 * Logo yazısı çizgiye çevrilmiş Baloo 2 ExtraBold; hiçbir yazı tipine bağlı değil.
 */

export const BRAND_COLORS = {
  /** Logo yazısı ve "net". */
  ink: "${RENK.ink}",
  /** Fosforlu kalem — yalnızca vurgu; metin rengi olarak kullanılmaz. */
  highlight: "${RENK.sari}",
} as const;

export const WORDMARK = {
  width: ${W.gen},
  height: ${W.yuk},
  viewBox: "0 0 ${W.gen} ${W.yuk}",
  /** "koçum." */
  koc: "${W.koc}",
  /** "net" — her zaman lacivert (sarı kalemin üstünde). */
  net: "${W.net}",
  /** Fosforlu kalem şekli. */
  swipe: "${W.kalem}",
} as const;

export const MONOGRAM = {
  viewBox: "0 0 64 64",
  radius: ${IKON.yaricap},
  k: "${IKON.k}",
} as const;
`;
yaz(join(here, "brand-paths.ts"), TS);
sayac++;

console.log(`marka kiti: ${sayac} dosya · logo ${W.gen}×${W.yuk} (oran ${(W.gen / W.yuk).toFixed(2)})`);
