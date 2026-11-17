import katex from "katex";

/**
 * Soru, şık ve çözüm metnini HTML'e çevirir (checkup/API.md "Yazım biçimi").
 *
 *   - Düz metin yazılır. Satır sonu `<br>` olur; boş satır paragrafı böler.
 *     Birden çok paragraf varsa her biri `<p>` içindedir; tek paragraflık
 *     metin (şıkların çoğu) sarılmaz. Çıktıda ham `\n` kalmaz: istemci
 *     `white-space: pre-line` kullanmaz.
 *   - `$...$` satır içi formül, `$$...$$` ayrı satırda ortalanmış formül
 *     (KaTeX `katex-display`, blok gibi davranır; yanındaki satır sonu atılır).
 *   - `\$` düz dolar işaretidir. Eşi olmayan `$` hatadır (yazar `\$` yazmalı).
 *   - Formül dışındaki her şey HTML'e çevrilmeden önce kaçışlanır.
 *   - KaTeX `trust: false`, `throwOnError: true` ile çalışır.
 *
 * Saf modül: veritabanı ya da Express bilmez. Hata `IcerikHatasi` olarak
 * fırlar; mesajı hangi formülün bozuk olduğunu söyleyen Türkçe bir cümledir.
 */

export class IcerikHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "IcerikHatasi";
  }
}

export type IcerikParcasi = { tur: "metin"; deger: string } | { tur: "formul"; latex: string; blok: boolean; sira: number };

const KISA = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Metni düz metin ve formül parçalarına ayırır. Eşi olmayan `$` ya da boş formülde IcerikHatasi. */
export function ayristir(girdi: string): IcerikParcasi[] {
  const s = girdi.replace(/\r\n?/g, "\n");
  const parcalar: IcerikParcasi[] = [];
  let tampon = "";
  let formulSirasi = 0;
  let i = 0;

  while (i < s.length) {
    const c = s[i]!;

    if (c === "\\" && s[i + 1] === "$") {
      tampon += "$";
      i += 2;
      continue;
    }

    if (c !== "$") {
      tampon += c;
      i += 1;
      continue;
    }

    const blok = s[i + 1] === "$";
    const bas = i + (blok ? 2 : 1);
    let j = bas;
    let kapanis = -1;
    while (j < s.length) {
      if (s[j] === "\\") {
        j += 2; // \$ ve \\ formülün içinde LaTeX komutudur; formülü kapatmaz
        continue;
      }
      if (s[j] === "$") {
        if (!blok) {
          kapanis = j;
          break;
        }
        if (s[j + 1] === "$") {
          kapanis = j;
          break;
        }
      }
      j += 1;
    }

    formulSirasi += 1;
    if (kapanis < 0) {
      const acan = blok ? "$$" : "$";
      throw new IcerikHatasi(
        `${formulSirasi}. formül kapanmamış: "${KISA(s.slice(i, i + 40))}" ile açılan ${acan} işaretinin eşi yok. Düz dolar işareti için \\$ yazın.`
      );
    }

    const latex = s.slice(bas, kapanis);
    if (!latex.trim()) {
      throw new IcerikHatasi(`${formulSirasi}. formül boş: "${blok ? "$$$$" : "$$"}" içinde bir şey yok. Düz dolar işareti için \\$ yazın.`);
    }

    if (tampon) parcalar.push({ tur: "metin", deger: tampon });
    tampon = "";
    parcalar.push({ tur: "formul", latex, blok, sira: formulSirasi });
    i = kapanis + (blok ? 2 : 1);
  }

  if (tampon) parcalar.push({ tur: "metin", deger: tampon });
  return parcalar;
}

export function htmlKacisla(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formulCiz(latex: string, blok: boolean, sira: number): string {
  try {
    return katex.renderToString(latexCizimi(latex), {
      displayMode: blok,
      throwOnError: true,
      trust: false,
      strict: "ignore", // formülde Türkçe harf uyarısı günlüğü doldurmasın
      maxSize: 20,
      maxExpand: 1000,
      output: "htmlAndMathml",
    });
  } catch (e) {
    if (e instanceof katex.ParseError) {
      const ayrinti = e.message.replace(/^KaTeX parse error:\s*/, "");
      const yazim = blok ? `$$${latex}$$` : `$${latex}$`;
      throw new IcerikHatasi(`${sira}. formül hatalı (${KISA(yazim)}): ${ayrinti}`);
    }
    throw e;
  }
}

type Belirtec = { tur: "html"; deger: string; blok?: boolean } | { tur: "satir" } | { tur: "paragraf" };

/** Boş satır (yalnızca boşluk içeren satırlar dahil) paragrafı böler. */
const BOS_SATIR = /\n[ \t]*\n(?:[ \t]*\n)*/;

/** Metni HTML'e çevirir. Hatalı formülde IcerikHatasi fırlatır. */
export function icerikHtml(metin: string): string {
  const belirtecler: Belirtec[] = [];
  for (const p of ayristir(metin)) {
    if (p.tur === "formul") {
      belirtecler.push({ tur: "html", deger: formulCiz(p.latex, p.blok, p.sira), blok: p.blok });
      continue;
    }
    p.deger.split(BOS_SATIR).forEach((paragraf, pi) => {
      if (pi > 0) belirtecler.push({ tur: "paragraf" });
      paragraf.split("\n").forEach((satir, si) => {
        if (si > 0) belirtecler.push({ tur: "satir" });
        if (satir) belirtecler.push({ tur: "html", deger: htmlKacisla(satir) });
      });
    });
  }

  // Paragraflara böl; baştaki/sondaki ve blok formüle bitişik satır sonlarını at.
  const paragraflar: Belirtec[][] = [[]];
  for (const b of belirtecler) {
    if (b.tur === "paragraf") paragraflar.push([]);
    else paragraflar.at(-1)!.push(b);
  }
  const html = paragraflar
    .map((ogeler) => {
      const tut = ogeler.filter((b, i) => {
        if (b.tur !== "satir") return true;
        const onceki = ogeler.slice(0, i).reverse().find((x) => x.tur !== "satir");
        const sonraki = ogeler.slice(i + 1).find((x) => x.tur !== "satir");
        if (!onceki || !sonraki) return false; // paragrafın başı ya da sonu
        if ((onceki.tur === "html" && onceki.blok) || (sonraki.tur === "html" && sonraki.blok)) return false;
        return ogeler[i - 1]?.tur !== "satir"; // art arda satır sonu tek <br> (boş satır zaten paragraf)
      });
      const icerik = tut.map((b) => (b.tur === "satir" ? "<br>" : b.tur === "html" ? b.deger : "")).join("");
      return { icerik, bos: !tut.some((b) => b.tur === "html" && (b.blok !== undefined || b.deger.trim())) };
    })
    .filter((p) => !p.bos);

  if (paragraflar.length === 0) return "";
  if (html.length === 1) return html[0]!.icerik.trim();
  return html.map((p) => `<p>${p.icerik.trim()}</p>`).join("");
}

/** Doğrulama için: hata cümlesi ya da null. */
export function icerikHatasi(metin: string): string | null {
  try {
    icerikHtml(metin);
    return null;
  } catch (e) {
    if (e instanceof IcerikHatasi) return e.message;
    throw e;
  }
}

// ─── Ondalık virgül ───────────────────────────────────────────
// KaTeX virgülü noktalama sayar ve arkasına boşluk koyar: `$3,5$` ekranda
// "3, 5" görünür. Yalnızca AÇIKÇA ondalık olan dizi `3{,}5` olarak çizilir.
// Koordinat, aralık ve küme (`A(3,5)`, `[0,1]`, `\{1,2,3\}`) değişmez; yazar
// ayraç içindeki ondalığı `3{,}5` yazarak zorlar. Saklanan kaynak DEĞİŞMEZ,
// dönüşüm yalnızca çizimde uygulanır.

const VIRGULLU_SAYI = /\d+(?:,\d+)+/g;
const BOSLUK = String.raw`(?:\s|~|\\[,;:! ]|\\q?quad\b)*`;
const ONDE_VIRGUL = new RegExp(String.raw`(?<!\\),${BOSLUK}$`);
const ARKADA_VIRGUL = new RegExp(`^${BOSLUK},`);
const ACAN_AYRAC = new RegExp(String.raw`(?:\(|\[|\\\{|\\lbrace|\\langle)${BOSLUK}[-+]?${BOSLUK}$`);
const KAPAYAN_AYRAC = new RegExp(String.raw`^${BOSLUK}(?:\\right\s*)?(?:\)|\]|\\\}|\\rbrace|\\rangle)`);

function ondalikMi(latex: string, bas: number, sayi: string): boolean {
  if (sayi.indexOf(",") !== sayi.lastIndexOf(",")) return false; // 1,2,3 liste
  const once = latex.slice(0, bas);
  const sonra = latex.slice(bas + sayi.length);
  if (ONDE_VIRGUL.test(once) || ARKADA_VIRGUL.test(sonra)) return false; // listenin parçası
  if (ACAN_AYRAC.test(once) && KAPAYAN_AYRAC.test(sonra)) return false; // (3,5) belirsiz çift
  return true;
}

export function latexCizimi(latex: string): string {
  return latex.replace(VIRGULLU_SAYI, (sayi: string, bas: number) => (ondalikMi(latex, bas, sayi) ? sayi.replace(",", "{,}") : sayi));
}
