/**
 * "Hocaya sorular" — cevap kuralları. Saf modül: ekran (istemci), eylemler
 * (sunucu), cevap dökümü (.md) ve app/scripts/hoca-cevap-test.mts aynı
 * doğrulamayı, aynı durum hesabını ve aynı dökümü kullanır.
 *
 * Hiçbir şey içe aktarmaz (yalnızca ./tipler'den TİP): app/ tarafındaki test bu
 * dosyayı panelin node_modules'u olmadan yükler (CI'da yalnızca app kurulu).
 * Bu yüzden zod da yok; doğrulama elle ve küçük.
 *
 * Kurallar:
 *  - "Hiç cevap yok" = değer de not da boş. Böyle bir kayıt tutulmaz (silinir).
 *  - Yazı sorusunda (metin) cevabın kendisi nottadır; değer yalnızca `{ tur: "metin" }`.
 *  - Durum: cevap yoksa bekliyor; `appliedAt` doluysa uygulandı; değilse cevaplandı.
 *  - Cevap (değer ya da not) değişirse "uygulandı" işareti kalkar — eylem yapar,
 *    karşılaştırma burada (`cevapEsitMi`, anahtar sırasından bağımsız).
 */
import type { CevapDegeri, CevapDurumu, HocaBolumu, HocaSorusu, TabloSutunu } from "./tipler";

/** Not (ve yazı sorusunun cevabı) en fazla bu kadar karakter. */
export const NOT_SINIRI = 2000;
/** "Uygulandı" işaretindeki kısa not. */
export const UYGULAMA_NOTU_SINIRI = 500;
/** Tablo hücresi en fazla bu kadar karakter. */
export const HUCRE_SINIRI = 200;
/** Gelen ham metin bundan uzunsa temizlemeye bile girmeden reddedilir. */
const HAM_SINIR = NOT_SINIRI * 5;

// ─── Küçük yardımcılar ───────────────────────────────────────────────

function nesneMi(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Satır sonları kalır (madde madde not yazılabilsin), denetim ve yön
 * karakterleri gider, üçten fazla boş satır ikiye iner, satır sonu boşlukları
 * silinir. (question-note.ts'teki notuTemizle'nin eşi; bu modül içe aktaramaz.)
 */
export function metniTemizle(ham: string): string {
  return ham
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, "")
    .replace(/[​‪-‮⁦-⁩﻿]/g, "")
    .replace(/[  ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tek satırlık hücre: bütün boşluklar teke iner. */
function hucreTemizle(ham: string): string {
  return metniTemizle(ham).replace(/\s+/g, " ");
}

const iki = (n: number) => String(n).padStart(2, "0");

/** Ayraç nokta, eğik çizgi, tire ya da virgül (telefonun sayı klavyesinde nokta olmayabilir). */
const TARIH = /^(\d{1,2})[.,/-](\d{1,2})[.,/-](\d{4})$/;

/** "1.6.2027", "01/06/2027", "1,6,2027" → "01.06.2027". Takvimde olmayan gün (31.02) ya da başka biçim: null. */
export function tarihCoz(ham: string): string | null {
  const m = TARIH.exec(ham.trim());
  if (!m) return null;
  const gun = Number(m[1]);
  const ay = Number(m[2]);
  const yil = Number(m[3]);
  if (yil < 1900 || yil > 2100) return null;
  const d = new Date(Date.UTC(yil, ay - 1, gun));
  if (d.getUTCFullYear() !== yil || d.getUTCMonth() !== ay - 1 || d.getUTCDate() !== gun) return null;
  return iki(gun) + "." + iki(ay) + "." + yil;
}

type Sonuc<T> = { ok: true; v: T } | { ok: false; hata: string };

const SAYI = /^[+-]?\d{1,9}(?:[.,]\d{1,6})?$/;
/** "1.000": bin mi, bir mi? Türkçede nokta binlik ayırıcı olabilir; tahmin etmiyoruz. */
const BELIRSIZ_BINLIK = /^[+-]?\d{1,3}\.\d{3}$/;

/** Sayı metni ya da sayı → sayı. Ondalık için virgül de nokta da olur. Boş: null. */
export function sayiCoz(ham: unknown): Sonuc<number | null> {
  if (ham === null || ham === undefined) return { ok: true, v: null };
  if (typeof ham === "number") {
    if (!Number.isFinite(ham) || Math.abs(ham) >= 1e9) return { ok: false, hata: "Geçerli bir sayı yazın." };
    return { ok: true, v: ham === 0 ? 0 : ham };
  }
  if (typeof ham !== "string") return { ok: false, hata: "Geçerli bir sayı yazın." };
  const s = ham.trim().replace(/\s+/g, "");
  if (s === "") return { ok: true, v: null };
  if (BELIRSIZ_BINLIK.test(s)) {
    return { ok: false, hata: `“${s}” anlaşılmıyor: binlik ayırıcı kullanmayın, ondalık için virgül yazın (ör. 0,25).` };
  }
  if (!SAYI.test(s)) return { ok: false, hata: "Yalnızca sayı yazın (ör. 40 ya da 0,25)." };
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? { ok: true, v: n === 0 ? 0 : n } : { ok: false, hata: "Geçerli bir sayı yazın." };
}

/** Sayıyı Türkçe yazar: 0.25 → "0,25". */
export function sayiYaz(n: number): string {
  return String(n).replace(".", ",");
}

/** Bir tablo hücresinin doğrulaması (ekran hücre altında gösterir; cevapDogrula da bunu kullanır). */
export function hucreDogrula(sutun: TabloSutunu, ham: unknown): Sonuc<string | null> {
  if (ham === null || ham === undefined) return { ok: true, v: null };
  if (typeof ham === "number") {
    if (sutun.tur !== "sayi") return { ok: false, hata: "Geçersiz hücre." };
    const s = sayiCoz(ham);
    return s.ok ? { ok: true, v: s.v === null ? null : sayiYaz(s.v) } : s;
  }
  if (typeof ham !== "string") return { ok: false, hata: "Geçersiz hücre." };
  if (ham.length > HUCRE_SINIRI * 5) return { ok: false, hata: `En fazla ${HUCRE_SINIRI} karakter yazın.` };
  const t = hucreTemizle(ham);
  if (t === "") return { ok: true, v: null };
  if (sutun.tur === "tarih") {
    const d = tarihCoz(t);
    return d ? { ok: true, v: d } : { ok: false, hata: "Tarihi GG.AA.YYYY biçiminde yazın (ör. 21.06.2027)." };
  }
  if (sutun.tur === "sayi") {
    const s = sayiCoz(t);
    return s.ok ? { ok: true, v: s.v === null ? null : sayiYaz(s.v) } : s;
  }
  if (t.length > HUCRE_SINIRI) return { ok: false, hata: `En fazla ${HUCRE_SINIRI} karakter yazın (şu an ${t.length}).` };
  return { ok: true, v: t };
}

/**
 * Sayıdan sonra gelen iyelik eki, okunuşa göre: 1’i, 2’si, 3’ü, 6’sı, 9’u,
 * 10’u, 40’ı, 100’ü, 1000’i. ("112 sorudan 23’ü cevaplandı".)
 */
export function iyelikEki(n: number): string {
  const x = Math.abs(Math.trunc(n));
  if (x === 0) return "’ı";
  const birler = ["", "’i", "’si", "’ü", "’ü", "’i", "’sı", "’si", "’i", "’u"];
  const onlar = ["", "’u", "’si", "’u", "’ı", "’si", "’ı", "’i", "’i", "’ı"];
  if (x % 10) return birler[x % 10];
  if (x % 100) return onlar[(x % 100) / 10];
  if (x % 1000) return "’ü"; // yüz
  if (x % 1_000_000) return "’i"; // bin
  return "’u"; // milyon
}

// ─── Doğrulama ──────────────────────────────────────────────────────

/** Ekrandan / eylemden gelen ham cevap. `deger` CevapDegeri biçiminde ama denetlenmemiş. */
export interface CevapGirdisi {
  deger?: unknown;
  not?: unknown;
}

export type Dogrulama =
  | {
      ok: true;
      /** Normalize edilmiş değer; yalnızca not yazıldıysa null. */
      deger: CevapDegeri | null;
      not: string | null;
      /** Ne değer ne not: "hiç cevap yok". */
      bos: boolean;
    }
  | {
      ok: false;
      hata: string;
      /** Hata bir tablo hücresindeyse yeri. */
      hucre?: { satir: string; sutun: string };
    };

const hata = (h: string, hucre?: { satir: string; sutun: string }): Dogrulama => ({ ok: false, hata: h, ...(hucre ? { hucre } : {}) });

function sinirMetni(birim: string | undefined, enAz: number | undefined, enCok: number | undefined): string {
  const b = birim ? " " + birim : "";
  if (enAz !== undefined && enCok !== undefined) return `${sayiYaz(enAz)} ile ${sayiYaz(enCok)}${b} arasında bir sayı yazın.`;
  if (enAz !== undefined) return `En az ${sayiYaz(enAz)}${b} yazabilirsiniz.`;
  return `En çok ${sayiYaz(enCok ?? 0)}${b} yazabilirsiniz.`;
}

/**
 * Gelen değeri sorunun cevap türüne göre doğrular ve normalize eder.
 * Seçenekler sorudaki sıraya dizilir, tablo hücreleri satır/sütun sırasına,
 * tarih GG.AA.YYYY'ye, sayı hücresi Türkçe yazıma ("0,25"); boş hücre atılır.
 */
export function cevapDogrula(soru: HocaSorusu, girdi: unknown): Dogrulama {
  if (girdi !== undefined && girdi !== null && !nesneMi(girdi)) return hata("Geçersiz cevap.");
  const g: CevapGirdisi = girdi ?? {};

  let not: string | null = null;
  if (g.not !== undefined && g.not !== null) {
    if (typeof g.not !== "string") return hata("Geçersiz not.");
    if (g.not.length > HAM_SINIR) return hata(`Not en fazla ${NOT_SINIRI} karakter olabilir.`);
    const t = metniTemizle(g.not);
    if (t.length > NOT_SINIRI) return hata(`Not en fazla ${NOT_SINIRI} karakter olabilir (şu an ${t.length}).`);
    not = t || null;
  }

  const alan = soru.cevap;
  const ham = g.deger;
  let deger: CevapDegeri | null = null;

  if (ham !== undefined && ham !== null) {
    if (!nesneMi(ham)) return hata("Geçersiz cevap.");
    if (ham.tur !== alan.tur) return hata("Cevap bu sorunun türüne uymuyor; sayfayı yenileyin.");

    switch (alan.tur) {
      case "uygunMu": {
        const k = ham.karar;
        if (k === undefined || k === null) break;
        if (k !== "uygun" && k !== "degissin") return hata("“Uygun” ya da “Değişsin” seçin.");
        deger = { tur: "uygunMu", karar: k };
        break;
      }
      case "secenek": {
        const s = ham.secilen;
        if (s === undefined || s === null) break;
        if (!Array.isArray(s) || s.length > alan.secenekler.length * 2) return hata("Geçersiz seçim.");
        const gecerli = new Set(alan.secenekler.map((o) => o.deger));
        const secilen = new Set<string>();
        for (const x of s) {
          if (typeof x !== "string" || !gecerli.has(x)) return hata("Bu soruda olmayan bir seçenek işaretlenmiş; sayfayı yenileyin.");
          secilen.add(x);
        }
        if (!alan.cokluSecim && secilen.size > 1) return hata("Bu soruda yalnızca bir seçenek işaretlenebilir.");
        if (secilen.size === 0) break;
        deger = { tur: "secenek", secilen: alan.secenekler.map((o) => o.deger).filter((d) => secilen.has(d)) };
        break;
      }
      case "sayi": {
        const s = sayiCoz(ham.sayi);
        if (!s.ok) return hata(s.hata);
        if (s.v === null) break;
        if ((alan.enAz !== undefined && s.v < alan.enAz) || (alan.enCok !== undefined && s.v > alan.enCok)) {
          return hata(sinirMetni(alan.birim, alan.enAz, alan.enCok));
        }
        deger = { tur: "sayi", sayi: s.v };
        break;
      }
      case "tablo": {
        const h = ham.hucreler;
        if (h === undefined || h === null) break;
        if (!nesneMi(h)) return hata("Geçersiz tablo.");
        const satirlar = new Set(alan.satirlar.map((r) => r.anahtar));
        const sutunlar = new Map(alan.sutunlar.map((c) => [c.anahtar, c]));
        const temiz = new Map<string, Map<string, string>>();
        for (const [satir, hucreler] of Object.entries(h)) {
          if (!satirlar.has(satir)) return hata("Tabloda olmayan bir satır gönderildi; sayfayı yenileyin.");
          if (hucreler === undefined || hucreler === null) continue;
          if (!nesneMi(hucreler)) return hata("Geçersiz tablo.");
          for (const [sutunAnahtari, deger] of Object.entries(hucreler)) {
            const sutun = sutunlar.get(sutunAnahtari);
            if (!sutun) return hata("Tabloda olmayan bir sütun gönderildi; sayfayı yenileyin.");
            const d = hucreDogrula(sutun, deger);
            if (!d.ok) {
              const satirAdi = alan.satirlar.find((r) => r.anahtar === satir)?.baslik ?? satir;
              return hata(`${satirAdi} · ${sutun.baslik}: ${d.hata}`, { satir, sutun: sutunAnahtari });
            }
            if (d.v === null) continue;
            if (!temiz.has(satir)) temiz.set(satir, new Map());
            temiz.get(satir)!.set(sutunAnahtari, d.v);
          }
        }
        if (temiz.size === 0) break;
        // Satır ve sütun sırası sorudaki gibi: döküm ve karşılaştırma kararlı olsun.
        const hucreler: Record<string, Record<string, string>> = {};
        for (const r of alan.satirlar) {
          const satir = temiz.get(r.anahtar);
          if (!satir) continue;
          hucreler[r.anahtar] = {};
          for (const c of alan.sutunlar) {
            const v = satir.get(c.anahtar);
            if (v !== undefined) hucreler[r.anahtar][c.anahtar] = v;
          }
        }
        deger = { tur: "tablo", hucreler };
        break;
      }
      case "metin":
        // Yazı sorusunun cevabı nottadır; değer aşağıda nottan türetilir.
        break;
    }
  }

  if (alan.tur === "metin") deger = not ? { tur: "metin" } : null;
  return { ok: true, deger, not, bos: deger === null && not === null };
}

/**
 * Veritabanındaki değeri (Json) bu sorunun ŞU ANKİ hâline göre okur. Soru
 * sonradan değiştiyse (tür, seçenek, satır) değer uymayabilir: `uyumsuz`.
 * Ekran o zaman yeniden cevap ister; döküm ham değeri yazar, hiçbir şey kaybolmaz.
 */
export function degerOku(soru: HocaSorusu, json: unknown): { deger: CevapDegeri | null; uyumsuz: boolean } {
  if (json === null || json === undefined) return { deger: null, uyumsuz: false };
  if (soru.cevap.tur === "metin") {
    return nesneMi(json) && json.tur === "metin" ? { deger: { tur: "metin" }, uyumsuz: false } : { deger: null, uyumsuz: true };
  }
  const d = cevapDogrula(soru, { deger: json });
  if (!d.ok || d.deger === null) return { deger: null, uyumsuz: true };
  return { deger: d.deger, uyumsuz: false };
}

/** Anahtar sırasından bağımsız JSON (PostgreSQL jsonb anahtarları yeniden dizer). */
export function kararliJson(x: unknown): string {
  const sirala = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sirala);
    if (nesneMi(v)) {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sirala(v[k])])
      );
    }
    return v;
  };
  return JSON.stringify(sirala(x) ?? null);
}

/** İki cevap aynı mı (değer ve not)? "Uygulandı" işareti yalnızca cevap değişince kalkar. */
export function cevapEsitMi(
  a: { deger: unknown; not: string | null | undefined },
  b: { deger: unknown; not: string | null | undefined }
): boolean {
  return kararliJson(a.deger ?? null) === kararliJson(b.deger ?? null) && (a.not || null) === (b.not || null);
}

// ─── Durum ──────────────────────────────────────────────────────────

/** TeacherAnswer satırının bu modülün okuduğu alanları. */
export interface CevapKaydi {
  questionKey: string;
  value: unknown;
  note: string | null;
  answeredByStaff: string | null;
  answeredAt: Date | null;
  appliedAt: Date | null;
  appliedByStaff: string | null;
  appliedNote: string | null;
}

export function cevapDurumu(k: Pick<CevapKaydi, "value" | "note" | "appliedAt"> | null | undefined): CevapDurumu {
  if (!k) return "bekliyor";
  const degerVar = k.value !== null && k.value !== undefined;
  const notVar = typeof k.note === "string" && k.note.trim() !== "";
  if (!degerVar && !notVar) return "bekliyor";
  return k.appliedAt ? "uygulandi" : "cevaplandi";
}

export const DURUM_ETIKETI: Record<CevapDurumu, string> = {
  bekliyor: "Bekliyor",
  cevaplandi: "Cevaplandı",
  uygulandi: "Uygulandı",
};

export const KARAR_ETIKETI = { uygun: "Uygun", degissin: "Değişsin" } as const;

// ─── Soru listesi, numara ───────────────────────────────────────────

export interface SoruKonumu {
  bolum: HocaBolumu;
  /** 1'den başlar. */
  bolumNo: number;
  soru: HocaSorusu;
  /** "bölüm.sıra": "3.2". */
  numara: string;
}

/** Bütün sorular, ekrandaki sırayla ve numaralarıyla. */
export function soruListesi(bolumler: readonly HocaBolumu[]): SoruKonumu[] {
  return bolumler.flatMap((bolum, i) =>
    bolum.sorular.map((soru, j) => ({ bolum, bolumNo: i + 1, soru, numara: `${i + 1}.${j + 1}` }))
  );
}

export function soruBul(bolumler: readonly HocaBolumu[], anahtar: string): SoruKonumu | null {
  return soruListesi(bolumler).find((s) => s.soru.anahtar === anahtar) ?? null;
}

export type DurumHaritasi = Readonly<Record<string, CevapDurumu | undefined>>;

/** Kayıtlardan soru anahtarı → durum (kaydı olmayan soru yok sayılır: bekliyor). */
export function durumHaritasi(kayitlar: readonly Pick<CevapKaydi, "questionKey" | "value" | "note" | "appliedAt">[]): Record<string, CevapDurumu> {
  return Object.fromEntries(kayitlar.map((k) => [k.questionKey, cevapDurumu(k)]));
}

// ─── İlerleme ve süzgeç ─────────────────────────────────────────────

export interface BolumIlerlemesi {
  anahtar: string;
  baslik: string;
  no: number;
  toplam: number;
  /** Cevaplanan (uygulananlar dahil). */
  cevaplanan: number;
  uygulanan: number;
  acilBekleyen: number;
}

export interface Ilerleme {
  toplam: number;
  /** Cevaplanan (uygulananlar dahil): "112 sorudan 23'ü cevaplandı". */
  cevaplanan: number;
  uygulanan: number;
  bekleyen: number;
  /** Önceliği "acil" olan soru sayısı. */
  acil: number;
  /** Acil ve hâlâ cevap bekleyen. */
  acilBekleyen: number;
  bolumler: BolumIlerlemesi[];
}

/** Soru listesinde olmayan anahtarların kaydı sayılmaz. */
export function ilerlemeHesapla(bolumler: readonly HocaBolumu[], durumlar: DurumHaritasi): Ilerleme {
  const sonuc: Ilerleme = { toplam: 0, cevaplanan: 0, uygulanan: 0, bekleyen: 0, acil: 0, acilBekleyen: 0, bolumler: [] };
  bolumler.forEach((b, i) => {
    const bi: BolumIlerlemesi = { anahtar: b.anahtar, baslik: b.baslik, no: i + 1, toplam: 0, cevaplanan: 0, uygulanan: 0, acilBekleyen: 0 };
    for (const s of b.sorular) {
      const d = durumlar[s.anahtar] ?? "bekliyor";
      const acil = s.oncelik === "acil";
      bi.toplam += 1;
      if (d !== "bekliyor") bi.cevaplanan += 1;
      if (d === "uygulandi") bi.uygulanan += 1;
      if (acil && d === "bekliyor") bi.acilBekleyen += 1;
      if (acil) sonuc.acil += 1;
    }
    sonuc.toplam += bi.toplam;
    sonuc.cevaplanan += bi.cevaplanan;
    sonuc.uygulanan += bi.uygulanan;
    sonuc.acilBekleyen += bi.acilBekleyen;
    sonuc.bolumler.push(bi);
  });
  sonuc.bekleyen = sonuc.toplam - sonuc.cevaplanan;
  return sonuc;
}

export const SUZGECLER = ["tumu", "bekleyen", "cevaplanan", "uygulanan", "acil"] as const;
export type Suzgec = (typeof SUZGECLER)[number];

export function isSuzgec(x: unknown): x is Suzgec {
  return typeof x === "string" && (SUZGECLER as readonly string[]).includes(x);
}

export const SUZGEC_ETIKETI: Record<Suzgec, string> = {
  tumu: "Tümü",
  bekleyen: "Bekleyen",
  cevaplanan: "Cevaplanan",
  uygulanan: "Uygulanan",
  acil: "Acil",
};

/**
 * Süzgeç sekmeleri ayrık: Bekleyen + Cevaplanan (henüz uygulanmamış) +
 * Uygulanan = Tümü. "Acil": önceliği acil ve hâlâ cevap bekleyen.
 */
export function suzgeceUyar(soru: Pick<HocaSorusu, "oncelik">, durum: CevapDurumu, s: Suzgec): boolean {
  switch (s) {
    case "tumu":
      return true;
    case "bekleyen":
      return durum === "bekliyor";
    case "cevaplanan":
      return durum === "cevaplandi";
    case "uygulanan":
      return durum === "uygulandi";
    case "acil":
      return soru.oncelik === "acil" && durum === "bekliyor";
  }
}

export function suzgecSayilari(bolumler: readonly HocaBolumu[], durumlar: DurumHaritasi): Record<Suzgec, number> {
  const say = Object.fromEntries(SUZGECLER.map((s) => [s, 0])) as Record<Suzgec, number>;
  for (const b of bolumler) {
    for (const soru of b.sorular) {
      const d = durumlar[soru.anahtar] ?? "bekliyor";
      for (const s of SUZGECLER) if (suzgeceUyar(soru, d, s)) say[s] += 1;
    }
  }
  return say;
}

// ─── İnsan okur cevap ve Markdown dökümü ────────────────────────────

/** Cevabın tek satırlık özeti: "Değişsin", "Birinci yol", "45 soru (şu an: 30)". */
export function cevapOzeti(soru: HocaSorusu, deger: CevapDegeri | null, secenek: { kod?: boolean } = {}): string {
  if (!deger) return "—";
  const alan = soru.cevap;
  switch (deger.tur) {
    case "uygunMu":
      return deger.karar === "uygun" ? "Uygun (şu anki hâli kalsın)" : "Değişsin";
    case "secenek": {
      const etiketler = alan.tur === "secenek" ? new Map(alan.secenekler.map((o) => [o.deger, o.etiket])) : new Map<string, string>();
      return deger.secilen
        .map((d) => {
          const etiket = etiketler.get(d) ?? d;
          return secenek.kod ? `${etiket} (\`${d}\`)` : etiket;
        })
        .join("; ");
    }
    case "sayi": {
      const birim = alan.tur === "sayi" && alan.birim ? " " + alan.birim : "";
      const simdi = alan.tur === "sayi" && alan.simdiki !== undefined ? ` (şu an: ${sayiYaz(alan.simdiki)}${birim})` : "";
      return sayiYaz(deger.sayi) + birim + simdi;
    }
    case "tablo": {
      const n = Object.values(deger.hucreler).reduce((t, r) => t + Object.keys(r).length, 0);
      return `${n} hücre değişti (boş bırakılanlarda sistemdeki değer kalır)`;
    }
    case "metin":
      return "Yazılı cevap (aşağıda)";
  }
}

/** Türkiye saatiyle "24.10.2026 14:05" (ICU sürümünden bağımsız, parça parça kurulur). */
function zamanYaz(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** Tablo hücresi için: | ve satır sonu bozmasın. */
const mdHucre = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
/** Alıntı bloğu: her satır "> " ile. */
const mdAlinti = (s: string) =>
  s
    .split("\n")
    .map((l) => (l ? "> " + l : ">"))
    .join("\n");

function tabloMd(soru: HocaSorusu, deger: Extract<CevapDegeri, { tur: "tablo" }>): string[] {
  if (soru.cevap.tur !== "tablo") return [];
  const alan = soru.cevap;
  const satirlar: string[] = ["| Satır | Sütun | Hocanın değeri | Şu an |", "| --- | --- | --- | --- |"];
  for (const r of alan.satirlar) {
    const h = deger.hucreler[r.anahtar];
    if (!h) continue;
    for (const c of alan.sutunlar) {
      const v = h[c.anahtar];
      if (v === undefined) continue;
      const simdi = r.simdiki[c.anahtar];
      const simdiMetni = simdi === null || simdi === undefined || simdi === "" ? "—" : typeof simdi === "number" ? sayiYaz(simdi) : simdi;
      const sutunAdi = c.baslik + (c.birim ? ` (${c.birim})` : "");
      satirlar.push(`| ${mdHucre(r.baslik)} | ${mdHucre(sutunAdi)} | ${mdHucre(v)} | ${mdHucre(String(simdiMetni))} |`);
    }
  }
  return satirlar;
}

/**
 * Cevapların Markdown dökümü — geliştirici okur ve sisteme işler. Her soru:
 * numara + başlık, anahtar, durum, cevap (insan okur), not, kim ve ne zaman,
 * uygulandıysa kim/ne zaman/not. Başta özet ve "uygulanmayı bekleyenler";
 * sonda soru listesinde artık olmayan anahtarların cevapları (ham hâliyle).
 */
export function cevaplarMarkdown(
  bolumler: readonly HocaBolumu[],
  kayitlar: readonly CevapKaydi[],
  secenek: { simdi: Date }
): string {
  const harita = new Map(kayitlar.map((k) => [k.questionKey, k]));
  const liste = soruListesi(bolumler);
  const bilinen = new Set(liste.map((s) => s.soru.anahtar));
  const durumlar = durumHaritasi(kayitlar);
  const ilerleme = ilerlemeHesapla(bolumler, durumlar);

  const c: string[] = [];
  c.push("# Hocaya sorular — cevaplar", "");
  c.push(`Dışa aktarma: ${zamanYaz(secenek.simdi)} (Türkiye saati)`, "");
  c.push(`- Toplam soru: ${ilerleme.toplam}`);
  c.push(
    `- Cevaplanan: ${ilerleme.cevaplanan} (uygulanan ${ilerleme.uygulanan}, uygulanmayı bekleyen ${ilerleme.cevaplanan - ilerleme.uygulanan})`
  );
  c.push(`- Cevap bekleyen: ${ilerleme.bekleyen} (acil ${ilerleme.acilBekleyen})`);
  c.push("");
  c.push("Cevap bekleyen soruda sistemdeki şu anki hâli geçerlidir. Bir cevap değişirse “uygulandı” işareti kalkar.", "");

  const uygulanacak = liste.filter((s) => durumlar[s.soru.anahtar] === "cevaplandi");
  c.push("## Uygulanmayı bekleyenler", "");
  if (uygulanacak.length === 0) c.push("Yok.");
  for (const s of uygulanacak) c.push(`- ${s.numara} \`${s.soru.anahtar}\` — ${s.soru.baslik}`);
  c.push("");

  bolumler.forEach((b, i) => {
    c.push(`## ${i + 1}. ${b.baslik}`, "");
    b.sorular.forEach((soru, j) => {
      const k = harita.get(soru.anahtar);
      const durum = cevapDurumu(k);
      c.push(`### ${i + 1}.${j + 1} ${soru.baslik}`, "");
      c.push(`- Anahtar: \`${soru.anahtar}\``);
      if (soru.oncelik === "acil") c.push("- Öncelik: Acil");
      if (!k || durum === "bekliyor") {
        c.push("- Durum: Bekliyor (cevap yok; sistemdeki hâli geçerli)", "");
        return;
      }
      c.push(`- Durum: ${DURUM_ETIKETI[durum]}`);
      const { deger, uyumsuz } = degerOku(soru, k.value);
      const metinSorusu = soru.cevap.tur === "metin";
      if (uyumsuz) {
        c.push(`- Cevap: ⚠️ soru sonradan değişmiş, kayıtlı değer bu soruya uymuyor. Ham değer: \`${kararliJson(k.value)}\``);
      } else if (!metinSorusu) {
        c.push(`- Cevap: ${deger ? cevapOzeti(soru, deger, { kod: true }) : "— (yalnızca not)"}`);
      }
      if (k.answeredByStaff || k.answeredAt) {
        c.push(`- Cevaplayan: ${k.answeredByStaff ?? "—"}${k.answeredAt ? " · " + zamanYaz(k.answeredAt) : ""}`);
      }
      if (k.appliedAt) {
        c.push(
          `- Uygulandı: ${zamanYaz(k.appliedAt)}${k.appliedByStaff ? " · " + k.appliedByStaff : ""}${k.appliedNote ? " — " + k.appliedNote.replace(/\s*\n\s*/g, " ") : ""}`
        );
      }
      c.push("");
      if (deger?.tur === "tablo") c.push(...tabloMd(soru, deger), "");
      if (k.note) c.push(metinSorusu ? "Cevap:" : "Not:", "", mdAlinti(k.note), "");
    });
  });

  const yetim = kayitlar.filter((k) => !bilinen.has(k.questionKey) && cevapDurumu(k) !== "bekliyor");
  if (yetim.length > 0) {
    c.push("## Soru listesinde olmayan cevaplar", "");
    c.push("Bu anahtarlar artık soru listesinde yok (soru silinmiş ya da anahtarı değişmiş). Cevaplar ham hâliyle:", "");
    for (const k of yetim) {
      c.push(`### \`${k.questionKey}\``, "");
      c.push(`- Değer: \`${kararliJson(k.value ?? null)}\``);
      if (k.answeredByStaff || k.answeredAt) {
        c.push(`- Cevaplayan: ${k.answeredByStaff ?? "—"}${k.answeredAt ? " · " + zamanYaz(k.answeredAt) : ""}`);
      }
      c.push("");
      if (k.note) c.push("Not:", "", mdAlinti(k.note), "");
    }
  }

  return c.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
