#!/usr/bin/env node
/**
 * Logo v3 — "bambaşka" yönler. Kare kutu içinde beyaz K'dan tamamen farklı:
 * her yönün kendi rengi, yazı tipi ve fikri var.
 *
 *   node logo/v3/build.mjs   →  logo/v3/sunum.html
 *
 * Yazı tipleri sunumda Google Fonts'tan gelir. Bir yön seçilince yazı
 * çizgiye (outline) çevrilip üretim SVG'si hazırlanır.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ONERI = "optik";

// ─────────────────────────────────────────────────────────────
// Semboller
// ─────────────────────────────────────────────────────────────

const OP = { ink: "#1c1f2b", coral: "#ef5b5b", paper: "#fff7f2" };
const K45 = [[0, 3], [0, 2], [0, 1], [0, 2], [0, 3]];
const K33 = [[0, 2], [0, 1], [0, 2]];
const HARF = ["A", "B", "C", "D"];

/** Optik form: 4 şık × 5 soru; doldurulan baloncuklar K çiziyor. */
function optik({ bg = false, etiket = false } = {}) {
  let s = `<svg viewBox="0 0 64 64" aria-hidden="true">${bg ? `<rect width="64" height="64" rx="14" fill="${OP.paper}"/>` : ""}`;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 4; c++) {
      const x = 14 + c * 12, y = 8 + r * 12;
      if (K45[r].includes(c)) s += `<circle cx="${x}" cy="${y}" r="4.6" fill="${OP.ink}"/>`;
      else {
        s += `<circle cx="${x}" cy="${y}" r="3.9" fill="none" stroke="${OP.coral}" stroke-width="1.4"/>`;
        if (etiket) s += `<text x="${x}" y="${y + 1.6}" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="4.4" fill="${OP.coral}">${HARF[c]}</text>`;
      }
    }
  return s + `</svg>`;
}
/** 16 px için 3 × 3 sadeleştirme. */
function optikKucuk() {
  let s = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="${OP.paper}"/>`;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const x = 7 + c * 9, y = 7 + r * 9;
      s += K33[r].includes(c)
        ? `<circle cx="${x}" cy="${y}" r="3.7" fill="${OP.ink}"/>`
        : `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${OP.coral}" stroke-width="1.4"/>`;
    }
  return s + `</svg>`;
}

const KC = { orange: "#ff6b3d", ink: "#1f1d33", cream: "#fff4ec" };
/** Geometrik koç başı — "koç" hem koç hem koç. */
function koc({ zemin = KC.orange, cizgi = KC.ink } = {}) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
<circle cx="32" cy="32" r="32" fill="${zemin}"/>
<g fill="none" stroke="${cizgi}" stroke-width="5.2" stroke-linecap="round">
<path d="M26.5 22.5 C21.5 12.5, 8 13.5, 8 25 C8 34, 18 36, 20.2 29.5 C21.6 25, 15.8 22.6, 14.2 27"/>
<path d="M37.5 22.5 C42.5 12.5, 56 13.5, 56 25 C56 34, 46 36, 43.8 29.5 C42.4 25, 48.2 22.6, 49.8 27"/>
</g>
<path d="M23.5 25 C23.5 19.2, 40.5 19.2, 40.5 25 L38.6 41.5 C37.6 49.5, 26.4 49.5, 25.4 41.5 Z" fill="${cizgi}"/>
<circle cx="28.3" cy="31" r="2" fill="${zemin}"/><circle cx="35.7" cy="31" r="2" fill="${zemin}"/>
<path d="M29.8 42.6 Q32 44.8 34.2 42.6" stroke="${zemin}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
</svg>`;
}

const FS = { yellow: "#ffd43b", ink: "#14213d" };
function fosforIkon() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="${FS.yellow}"/>
<text x="32" y="47" text-anchor="middle" font-family="'Baloo 2'" font-weight="800" font-size="48" fill="${FS.ink}">k</text></svg>`;
}

const MH = { green: "#1e4636", cream: "#f4ecdd", gold: "#c8a14a" };
let muhurSayac = 0;
function muhur({ kucuk = false } = {}) {
  const id = `halka${++muhurSayac}`;
  if (kucuk)
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${MH.green}"/><circle cx="32" cy="32" r="27" fill="none" stroke="${MH.gold}" stroke-width="1.6"/>
<text x="32" y="45" text-anchor="middle" font-family="'DM Serif Display'" font-size="38" fill="${MH.cream}">K</text></svg>`;
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
<defs><path id="${id}" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs>
<circle cx="60" cy="60" r="59" fill="${MH.green}"/>
<circle cx="60" cy="60" r="55" fill="none" stroke="${MH.gold}" stroke-width="1.2"/>
<circle cx="60" cy="60" r="37" fill="none" stroke="${MH.gold}" stroke-width="1"/>
<text font-family="Inter" font-weight="700" font-size="8.2" letter-spacing="1.6" fill="${MH.gold}"><textPath href="#${id}" textLength="286" lengthAdjust="spacing">KOÇUM.NET · SINAVA KADAR AKLINDA ·</textPath></text>
<text x="60" y="76" text-anchor="middle" font-family="'DM Serif Display'" font-size="46" fill="${MH.cream}">K</text>
</svg>`;
}

const AF = { paper: "#fbf7ef", blue: "#2340a0", red: "#e5383b" };
const TIK = `<path d="M13 33.5 C16.5 35 20.5 40 24.5 47.5 C25.2 48.8 26.7 48.7 27.4 47.4 C33 36 41.5 24.5 52.5 15.5 C53.6 14.6 52.6 13 51.3 13.7 C39.8 20 31.7 30.4 26.3 41 C23.6 36.4 20.2 32.6 15.4 30.9 C13.3 30.2 11.5 32.8 13 33.5 Z" fill="${AF.red}"/>`;
function aferinIkon() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${AF.paper}"/>
<text x="27" y="50" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="56" fill="${AF.blue}">k</text>
<g transform="translate(30 6) scale(0.48)">${TIK}</g></svg>`;
}
const tik = () => `<svg class="tik" viewBox="8 8 50 44" aria-hidden="true">${TIK}</svg>`;

const BL = { black: "#111111", acid: "#c6f35e" };
function blokIkon() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="${BL.black}"/>
<text x="11" y="47" font-family="'Archivo Black'" font-size="40" fill="#fff">K</text><rect x="44" y="39" width="9" height="9" fill="${BL.acid}"/></svg>`;
}

// ─────────────────────────────────────────────────────────────
// Kilitlenmeler (işaret + yazı). Boyut em ile: kapsayıcının font-size'ı ölçek.
// ─────────────────────────────────────────────────────────────

const LOCKUP = {
  optik: () => `<div class="lk optik"><span class="sym" style="width:1.6em;height:1.6em">${optik({ etiket: true })}</span>
<span class="t"><span class="wm">koçum<i>.</i>net</span><span class="tag">sınava kadar aklında</span></span></div>`,
  koc: () => `<div class="lk koc"><span class="sym" style="width:1.45em;height:1.45em">${koc()}</span>
<span class="t"><span class="wm">Koçum<i>.net</i></span><span class="tag">Sınava kadar aklında</span></span></div>`,
  fosfor: () => `<div class="lk fosfor"><span class="t"><span class="wm">koçum.<mark>net</mark></span><span class="tag">sınav koçluğu · soru bankası · check-up</span></span></div>`,
  muhur: () => `<div class="lk muhur"><span class="sym" style="width:2.3em;height:2.3em">${muhur()}</span>
<span class="t"><span class="wm">Koçum.Net</span><span class="tag">SINAV KOÇLUĞU</span></span></div>`,
  aferin: () => `<div class="lk aferin"><span class="wm">koçum<svg class="alt" viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true"><path d="M4 14 C50 6 120 5 196 12" stroke="${AF.red}" stroke-width="5" stroke-linecap="round" fill="none"/></svg></span>${tik()}<span class="net">.net</span></div>`,
  blok: () => `<div class="lk blok"><span class="kutu">KOÇUM<b>.NET</b></span><span class="tag">Sınava<br>kadar<br>aklında.</span></div>`,
};

const IKON = {
  optik: () => optik({ bg: true }),
  koc: () => koc(),
  fosfor: fosforIkon,
  muhur: () => muhur({ kucuk: true }),
  aferin: aferinIkon,
  blok: blokIkon,
};
const FAVICON = { ...IKON, optik: optikKucuk };

// ─────────────────────────────────────────────────────────────
// Yönler
// ─────────────────────────────────────────────────────────────

const YONLER = [
  {
    kod: "optik", ad: "Optik", sahne: OP.paper,
    renk: [["Mürekkep", OP.ink], ["Optik pembesi", OP.coral], ["Kâğıt", OP.paper]],
    yazi: "Manrope ExtraBold",
    fikir: "Sınav kâğıdı. Optik formda doldurulan baloncuklar bir K çiziyor. Türkiye'de sınava giren her öğrenci bu formu ilk bakışta tanır.",
    neden: "Yalnızca bu sektöre ait, kimsenin kopyalayamayacağı bir görüntü. Baloncuk her yere taşınır: yükleniyor animasyonu, ilerleme çubuğu, sosyal medya şablonu, fasikül kapağı.",
    risk: "Noktalı yapı 16 px'te sadeleşmeli (sekmede 3 × 3'lük K kullanılıyor).",
  },
  {
    kod: "koc", ad: "Koç", sahne: KC.cream,
    renk: [["Turuncu", KC.orange], ["Gece", KC.ink], ["Krem", KC.cream]],
    yazi: "Outfit ExtraBold",
    fikir: "\"Koçum!\" diye seslenen biri. Koç hem koç hem koç: boynuzları kıvrık, sevimli ama kararlı bir amblem.",
    neden: "En sıcak ve en akılda kalan seçenek; çıkartma, maskot, sosyal medya için kendiliğinden karakter. Gençlere hitap ediyor.",
    risk: "Koç burcu (♈) çağrışımı. Velilere fazla oyuncu gelebilir. Üretimde bir illüstratörün elinden geçmeli.",
  },
  {
    kod: "fosfor", ad: "Fosfor", sahne: "#ffffff",
    renk: [["Fosforlu sarı", FS.yellow], ["Lacivert", FS.ink], ["Beyaz", "#ffffff"]],
    yazi: "Baloo 2 ExtraBold",
    fikir: "Ders çalışan birinin masası. \"net\" fosforlu kalemle çizilmiş: sınavda önemli olan tek şey net.",
    neden: "Alan adı bir kelime oyununa dönüşüyor (.net = sınav neti). Simge gerektirmeyen, enerjik, eğlenceli bir yazı logosu.",
    risk: "Simgesi zayıf: ikon tek başına bir harf. Fosfor sarısı beyaz zeminde küçük yazılarda okunmaz, yalnızca vurgu için.",
  },
  {
    kod: "muhur", ad: "Mühür", sahne: MH.cream,
    renk: [["Orman yeşili", MH.green], ["Altın", MH.gold], ["Fildişi", MH.cream]],
    yazi: "DM Serif Display",
    fikir: "Köklü bir dershane ya da üniversite mührü. Ciddi, güven veren, kurumsal.",
    neden: "Velilere ve yetişkin adaylara (KPSS, ALES, DGS) en güven veren seçenek. Belge, sertifika, karne üzerinde çok iyi durur.",
    risk: "Gençlere eski moda gelebilir. Halkadaki yazı küçük boyutta okunmaz; ikon yalnızca K.",
  },
  {
    kod: "aferin", ad: "Aferin", sahne: AF.paper,
    renk: [["Dolma kalem mavisi", AF.blue], ["Öğretmen kırmızısı", AF.red], ["Defter", AF.paper]],
    yazi: "Caveat (geçici; özel el yazısı çizilmeli)",
    fikir: "Öğretmenin kâğıda düştüğü not: \"Aferin koçum ✓\". El yazısı, kırmızı kalemle altı çizili.",
    neden: "Koçluğun insani yanı: kişisel, sıcak, seninle ilgilenen biri var. Markanın sesiyle birebir örtüşüyor.",
    risk: "Hazır el yazısı fonttan logo ucuz durur; yayına çıkmadan özel çizim şart. Uzun metinlerde okunurluk düşük.",
  },
  {
    kod: "blok", ad: "Blok", sahne: "#f2f2ee",
    renk: [["Siyah", BL.black], ["Asit yeşili", BL.acid], ["Beyaz", "#ffffff"]],
    yazi: "Archivo Black",
    fikir: "Spor markası ya da dergi kapağı gibi: kalın, büyük harf, kare blok. \".NET\" skor tabelası gibi parlıyor.",
    neden: "En cesur ve en güncel görünen seçenek; Instagram ve reklam görsellerinde dikkat çeker.",
    risk: "Moda akımına bağlı; birkaç yıl içinde eskiyebilir. Velilere sert ve soğuk gelebilir.",
  },
];

// ─────────────────────────────────────────────────────────────
// Sayfa
// ─────────────────────────────────────────────────────────────

const fosforBoya = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M6 14 C50 6 120 11 196 4 L198 50 C140 57 70 51 2 57 Z" fill="${FS.yellow}"/></svg>`
);

const kart = (y, i) => `
<section class="yon${y.kod === ONERI ? " oneri" : ""}" id="${y.kod}">
  <div class="sahne" style="background:${y.sahne}">
    ${y.kod === ONERI ? `<span class="rozet">Önerim</span>` : ""}
    <div class="buyuk">${LOCKUP[y.kod]()}</div>
  </div>
  <div class="detay">
    <h2><span class="no">${i + 1}</span>${y.ad}</h2>
    <p class="fikir">${y.fikir}</p>
    <div class="baglam">
      <div class="mock baslik"><div class="kucuk">${LOCKUP[y.kod]()}</div><nav>Hizmetler · Blog · İletişim</nav></div>
      <div class="satir">
        <div class="mock sekme"><span class="fav">${FAVICON[y.kod]()}</span><span>Koçum.Net — Sınava kadar aklında</span></div>
        <div class="uyg"><span class="ikon">${IKON[y.kod]()}</span><small>Koçum.Net</small></div>
      </div>
    </div>
    <dl>
      <div><dt>Neden</dt><dd>${y.neden}</dd></div>
      <div><dt>Risk</dt><dd>${y.risk}</dd></div>
    </dl>
    <p class="palet">${y.renk.map(([ad, hex]) => `<span><i style="background:${hex}"></i>${ad}</span>`).join("")}<span class="font">${y.yazi}</span></p>
  </div>
</section>`;

const telefon = YONLER.map((y) => `<a class="app" href="#${y.kod}"><span class="ikon">${IKON[y.kod]()}</span><small>${y.ad}</small></a>`).join("");
const sekmeler = YONLER.map((y) => `<a class="mock sekme dar" href="#${y.kod}"><span class="fav">${FAVICON[y.kod]()}</span><span>${y.ad}</span></a>`).join("");

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Koçum.Net · bambaşka logo yönleri</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Baloo+2:wght@800&family=Caveat:wght@700&family=DM+Serif+Display&family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&family=Outfit:wght@600;800&display=swap">
<style>
  :root { --ink:#16181f; --soft:#555b6b; --faint:#7a8090; --line:#e8e8ec; color-scheme: light; }
  * { box-sizing:border-box; }
  body { margin:0; background:#fafafa; color:var(--soft); font:15px/1.6 Inter, system-ui, sans-serif; }
  main { max-width:1160px; margin:0 auto; padding:40px 16px 72px; }
  h1 { font:700 32px/1.15 Inter, sans-serif; color:var(--ink); margin:0; letter-spacing:-.02em; }
  .giris { max-width:760px; margin:10px 0 0; }
  .baslik2 { margin:30px 0 10px; font:700 12px/1 Inter, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); }
  .telefon { display:flex; flex-wrap:wrap; gap:18px; padding:22px; border-radius:24px; background:linear-gradient(160deg,#3a4256,#141821); }
  .app { display:flex; flex-direction:column; align-items:center; gap:6px; text-decoration:none; }
  .app small { color:#fff; font-size:11px; }
  .ikon { display:block; width:60px; height:60px; border-radius:14px; overflow:hidden; }
  .ikon svg, .fav svg, .sym svg { width:100%; height:100%; display:block; }
  .sekmeler { display:flex; flex-wrap:wrap; gap:8px; }
  .mock { display:flex; align-items:center; gap:10px; border:1px solid var(--line); border-radius:12px; background:#fff; color:var(--ink); text-decoration:none; }
  .sekme { gap:8px; padding:8px 12px; background:#eef0f3; border-radius:10px 10px 0 0; border-bottom:none; font-size:12px; min-width:0; flex:1; }
  .sekme span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sekme.dar { flex:0 0 auto; border-radius:10px; border-bottom:1px solid var(--line); }
  .fav { display:block; width:16px; height:16px; flex:0 0 16px; }

  .yon { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); margin-top:28px; background:#fff; border:1px solid var(--line); border-radius:24px; overflow:hidden; }
  .yon.oneri { border:2px solid #16181f; box-shadow:0 18px 40px -22px rgb(0 0 0 / .35); }
  .sahne { position:relative; display:flex; align-items:center; justify-content:center; min-height:300px; padding:40px 24px; }
  .rozet { position:absolute; top:16px; left:16px; background:#16181f; color:#fff; font:600 12px/1 Inter, sans-serif; padding:7px 11px; border-radius:999px; }
  .buyuk { font-size:52px; }
  .detay { padding:26px; }
  h2 { display:flex; align-items:center; gap:10px; font:700 24px/1.2 Inter, sans-serif; color:var(--ink); margin:0 0 6px; letter-spacing:-.01em; }
  h2 .no { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#f0f0f3; font-size:13px; color:var(--soft); }
  .fikir { margin:0 0 16px; }
  .baglam { display:grid; grid-template-columns:minmax(0,1fr); gap:10px; }
  .detay { min-width:0; }
  .baslik { padding:10px 14px; }
  .baslik .kucuk { font-size:20px; }
  .baslik nav { margin-left:auto; font-size:12px; color:var(--faint); white-space:nowrap; }
  .satir { display:flex; align-items:center; gap:12px; }
  .uyg { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 12px; border-radius:16px; background:linear-gradient(160deg,#3a4256,#141821); }
  .uyg .ikon { width:52px; height:52px; border-radius:12px; }
  .uyg small { color:#fff; font-size:10px; }
  dl { margin:16px 0 0; display:grid; gap:8px; font-size:13.5px; }
  dl div { display:grid; grid-template-columns:52px 1fr; gap:8px; }
  dt { font-weight:700; color:var(--ink); } dd { margin:0; }
  .palet { display:flex; flex-wrap:wrap; gap:6px 14px; margin:16px 0 0; font-size:12px; color:var(--faint); }
  .palet span { display:inline-flex; align-items:center; gap:6px; }
  .palet i { width:14px; height:14px; border-radius:50%; box-shadow:inset 0 0 0 1px rgb(0 0 0 / .12); }
  .palet .font { font-style:italic; }

  /* Kilitlenmeler — ölçek kapsayıcının font-size'ı */
  .lk { display:inline-flex; align-items:center; gap:.35em; line-height:1; white-space:nowrap; }
  .lk .t { display:flex; flex-direction:column; gap:.18em; }
  .lk .tag { font-size:.28em; }
  .kucuk .tag { display:none; }
  .sym { display:block; flex:none; }

  .optik .wm { font-family:Manrope, sans-serif; font-weight:800; color:${OP.ink}; letter-spacing:-.035em; }
  .optik .wm i { font-style:normal; color:${OP.coral}; }
  .optik .tag { font-family:Manrope, sans-serif; font-weight:700; color:${OP.coral}; letter-spacing:.02em; }

  .koc .wm { font-family:Outfit, sans-serif; font-weight:800; color:${KC.ink}; letter-spacing:-.03em; }
  .koc .wm i { font-style:normal; font-weight:600; color:${KC.orange}; }
  .koc .tag { font-family:Outfit, sans-serif; font-weight:600; color:${KC.ink}; opacity:.7; }

  .fosfor .wm { position:relative; isolation:isolate; font-family:'Baloo 2', sans-serif; font-weight:800; font-size:1.25em; color:${FS.ink}; letter-spacing:-.02em; }
  .fosfor mark { position:relative; background:none; color:inherit; padding:0 .04em; }
  .fosfor mark::before { content:""; position:absolute; z-index:-1; left:-.06em; right:-.08em; top:.3em; bottom:.12em; background:url("data:image/svg+xml,${fosforBoya}") no-repeat center/100% 100%; transform:rotate(-2.5deg); }
  .fosfor .tag { font-family:Inter, sans-serif; font-weight:600; color:${FS.ink}; opacity:.65; font-size:.24em; }

  .muhur .wm { font-family:'DM Serif Display', serif; color:${MH.green}; font-size:1.05em; }
  .muhur .tag { font-family:Inter, sans-serif; font-weight:700; color:${MH.gold}; letter-spacing:.32em; font-size:.22em; }

  .aferin { gap:.08em; align-items:flex-end; }
  .aferin .wm { position:relative; font-family:Caveat, cursive; font-weight:700; font-size:1.55em; color:${AF.blue}; line-height:.9; }
  .aferin .alt { position:absolute; left:.02em; right:-.04em; bottom:-.12em; height:.2em; width:100%; }
  .aferin .tik { width:.8em; height:.7em; margin:0 .06em .55em .04em; }
  .aferin .net { font-family:Inter, sans-serif; font-weight:700; font-size:.36em; color:${AF.blue}; opacity:.75; margin-bottom:.35em; letter-spacing:.04em; }

  .blok { gap:.4em; }
  .blok .kutu { display:inline-flex; flex-direction:column; justify-content:flex-end; width:4.6em; height:4.6em; padding:.3em .28em; border-radius:.22em; background:${BL.black}; color:#fff; font-family:'Archivo Black', sans-serif; font-size:.62em; line-height:.92; letter-spacing:-.02em; }
  .blok .kutu b { color:${BL.acid}; font-weight:400; }
  .blok .tag { font-family:'Archivo Black', sans-serif; font-size:.3em; line-height:1.05; color:${BL.black}; text-transform:uppercase; }
  .kucuk .blok .kutu { font-size:.42em; }

  @media (max-width: 860px) {
    .yon { grid-template-columns:minmax(0,1fr); }
    .sahne { min-height:220px; }
    .buyuk { font-size:32px; }
    .baslik nav { display:none; }
  }
</style>
</head>
<body>
<main>
  <h1>Koçum.Net · bambaşka yönler</h1>
  <p class="giris">Kare kutuda beyaz K yok. Altı ayrı dünya: her birinin kendi fikri, rengi ve yazı tipi var. Her yön büyük hâliyle, sitenin başlığında, tarayıcı sekmesinde ve telefon ana ekranında. Renkler değiştirilebilir; önce <strong>fikri</strong> seç.</p>

  <p class="baslik2">Telefon ana ekranında</p>
  <div class="telefon">${telefon}</div>

  <p class="baslik2">Tarayıcı sekmesinde (16 px)</p>
  <div class="sekmeler">${sekmeler}</div>

  ${YONLER.map(kart).join("")}
</main>
</body>
</html>`;

writeFileSync(join(here, "sunum.html"), html);
console.log("yazıldı: logo/v3/sunum.html");
