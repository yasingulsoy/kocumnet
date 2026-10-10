// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/question-import.ts · eşitlemek için: npm run checkup:sync

/**
 * Soru dosyası içe aktarma — ÇÖZÜMLEME ve DENETİM (saf modül).
 *
 * SORU-SABLONU.md (v3) biçimindeki markdown metnini sorulara ayırır ve her
 * soruyu şablonun kurallarıyla denetler. İki yer kullanıyor:
 *   · scripts/import-questions.mts — komut satırı
 *   · yönetim paneli › Check-up › Sorular › Toplu içe aktar (admin/, kopya)
 * Kurallar tek yerde: panelde geçen dosya betikte de geçer, biri reddederse
 * öteki de reddeder.
 *
 * Veritabanı, dosya sistemi ve Next bilmez. Havuzdaki konular, kimlikler,
 * parmak izleri, kazanımlar ve görsellerin varlığı `IceAktarmaBaglami` ile
 * dışarıdan gelir; yazmak da çağıranın işi. Panel bu dosyanın kopyasını
 * kullandığı için (admin/scripts/checkup-sync.mjs) yalnızca göreli import.
 *
 * Denetim bir soruda İLK hatada durmaz, bütün hataları toplar: içerik ekibi
 * 300 soruluk dosyayı tek turda düzeltebilsin. Sıra eski betiğin sırası;
 * `hatalar[0]` betiğin raporuna yazdığı satırdır (komut satırı raporu
 * değişmesin diye). Sonradan eklenen kurallar en sonda denetlenir.
 */
import { ERROR_TYPES } from "./error-types";
import { konuSinavdaMi } from "./exam-scope";
import { EXAM_SCOPES } from "./exams";
import { markupToContent } from "./question-markup";
import {
  CHOICE_LABELS,
  deriveQuestionFields,
  safeParseQuestionContent,
  validateChoices,
  type ChoiceDraft,
  type InlineNode,
  type QuestionContent,
} from "./question-content";

// ─────────────────────────────────────────────────────────────
// Sabitler
// ─────────────────────────────────────────────────────────────

/** Kabul edilen görsel türleri (uzantıya göre). SVG bilerek yok: script taşıyabilir. */
export const GORSEL_UZANTILARI: readonly string[] = [".png", ".jpg", ".jpeg", ".webp"];

export const GORSEL_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** `Seviye` alanının değerleri → şemadaki QuestionLevel. */
const SEVIYELER = { "1": "L1_TEMEL", "2": "L2_ORTA", "3": "L3_ANALIZ" } as const;
export type SoruSeviyesi = (typeof SEVIYELER)[keyof typeof SEVIYELER];
export type SinavKodu = (typeof EXAM_SCOPES)[number];

/** Şablonun tanıdığı alanlar (ad() ile indirgenmiş hâlleri). */
const BILINEN_ALANLAR = new Set([
  "id",
  "konu kodu",
  "kazanim kodu",
  "kazanim adi",
  "zorluk",
  "seviye",
  "ideal sure",
  "kaynak",
  "hedef sinav",
  "gorsel",
  "soru metni",
  "secenekler",
  "dogru sik",
  "cozum aciklamasi",
]);

/** v2'den kalan ya da sık karıştırılan alanlar: yok sayılır, nedeni söylenir. */
const ESKI_ALANLAR: Record<string, string> = {
  cift: '"Çift" alanı v3\'te kalktı; yok sayıldı.',
  kazanim: '"Kazanım" alanı v3\'te yok: Kazanım Kodu ve (ilk kullanımda) Kazanım Adı yaz.',
};

// ─────────────────────────────────────────────────────────────
// Çözümleme
// ─────────────────────────────────────────────────────────────

export interface HamSecenek {
  satir: number;
  isaretli: boolean;
  harf: string;
  metin: string;
  hataKodu: string | null;
  not: string | null;
}

export interface HamSoru {
  /** `### …` başlığının satırı (1'den). */
  satir: number;
  baslik: string;
  /** İndirgenmiş alan adı → değer ("ideal sure" → "60"). */
  alanlar: Record<string, string>;
  /** İndirgenmiş alan adı → dosyada yazıldığı hâli, satırı, kaç kez yazıldığı. */
  alanBilgisi: Record<string, { ad: string; satir: number; kez: number }>;
  secenekler: HamSecenek[];
}

/** `* **Alan:** değer` başlığını yakalar. Değer aynı satırda ya da sonraki satırlarda. */
const ALAN = /^\*\s+\*\*([^*]+?):\*\*\s*(.*)$/;
/** `  * [x] B) 18 (KOD: açıklama)` */
const SECENEK = /^\s*\*\s+\[( |x|X)\]\s+([A-E])\)\s*(.*)$/;
const HATA_KODU = /\(([A-Z_]+)(?::\s*([^)]*))?\)\s*$/;
/** `![alt](dosya)` — question-markup.ts'teki görsel belirteciyle aynı desen. */
const GORSEL = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/**
 * Alan adlarını ASCII anahtara indirger: "İdeal Süre" → "ideal sure",
 * "Doğru Şık" → "dogru sik". Türkçe yerel ayarla küçültmek TUZAK: "ID" →
 * "ıd" oluyor (noktasız ı) ve hiçbir anahtar eşleşmiyor. Aksanlar atılıp
 * yerelden bağımsız küçültülüyor; hoca "Ideal Sure" yazsa da eşleşir.
 */
const ad = (s: string) =>
  s
    .trim()
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Dosya adının uzantısı, küçük harfle (".png"). Node'un extname'i gibi: ".png" adlı dosyanın uzantısı yok. */
function uzanti(dosya: string): string {
  const taban = dosya.slice(Math.max(dosya.lastIndexOf("/"), dosya.lastIndexOf("\\")) + 1);
  const i = taban.lastIndexOf(".");
  return i > 0 ? taban.slice(i).toLowerCase() : "";
}

/** Markdown metnini `### …` başlıklarından sorulara ayırır. Denetim yapmaz. */
export function dosyayiCozumle(metin: string): HamSoru[] {
  // Baştaki BOM: Windows'ta "UTF-8 (BOM'lu)" kaydedilen dosyada ilk satır
  // "﻿### Soru 01" olur ve ilk soru sessizce kaybolurdu.
  const satirlar = metin.replace(/^﻿/, "").replace(/\r\n/g, "\n").split("\n");
  const sorular: HamSoru[] = [];
  let mevcut: HamSoru | null = null;
  let aktifAlan: string | null = null;
  let kodBlogu = false;

  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];

    // ```markdown ... ``` blokları (şablondaki örnek) atlanır — gerçek dosyada olmaz.
    if (s.trim().startsWith("```")) {
      kodBlogu = !kodBlogu;
      continue;
    }
    if (kodBlogu) continue;

    const baslik = s.match(/^###\s+(.+)$/);
    if (baslik) {
      // Prototipsiz nesne: "__proto__" gibi bir alan adı prototipe yazılmasın.
      mevcut = {
        satir: i + 1,
        baslik: baslik[1].trim(),
        alanlar: Object.create(null),
        alanBilgisi: Object.create(null),
        secenekler: [],
      };
      sorular.push(mevcut);
      aktifAlan = null;
      continue;
    }
    if (!mevcut) continue;
    if (s.trim() === "---") {
      aktifAlan = null;
      continue;
    }

    const alan = s.match(ALAN);
    if (alan) {
      aktifAlan = ad(alan[1]);
      const onceki = mevcut.alanBilgisi[aktifAlan];
      mevcut.alanBilgisi[aktifAlan] = { ad: alan[1].trim(), satir: i + 1, kez: (onceki?.kez ?? 0) + 1 };
      mevcut.alanlar[aktifAlan] = alan[2].trim();
      continue;
    }

    const sec = s.match(SECENEK);
    if (sec && aktifAlan === "secenekler") {
      let govde = sec[3].trim();
      let hataKodu: string | null = null;
      let not: string | null = null;
      const h = govde.match(HATA_KODU);
      if (h) {
        hataKodu = h[1];
        not = h[2]?.trim() || null;
        govde = govde.slice(0, h.index).trim();
      }
      mevcut.secenekler.push({ satir: i + 1, isaretli: sec[1].toLowerCase() === "x", harf: sec[2], metin: govde, hataKodu, not });
      continue;
    }

    // Çok satırlı alan devamı (soru metni, çözüm, kazanım adı…).
    if (aktifAlan && aktifAlan !== "secenekler") {
      mevcut.alanlar[aktifAlan] = (mevcut.alanlar[aktifAlan] + "\n" + s).replace(/^\n+/, "");
    }
  }

  for (const q of sorular) for (const k of Object.keys(q.alanlar)) q.alanlar[k] = q.alanlar[k].trim();
  return sorular;
}

/**
 * Dosyada `![alt](dosya)` ile anılan görsel adları (tekil, ilk geçiş sırasıyla).
 * Soru metninin yanında şık ve çözüm de taranır: oradaki görsel reddedilir
 * ama "kullanılmayan görsel" diye ayrıca uyarılmasın.
 */
export function anilanGorseller(ham: readonly HamSoru[]): string[] {
  const adlar = new Set<string>();
  for (const q of ham) {
    const metinler = [q.alanlar["soru metni"] ?? "", q.alanlar["cozum aciklamasi"] ?? "", ...q.secenekler.map((s) => s.metin)];
    for (const metin of metinler) for (const m of metin.matchAll(GORSEL)) adlar.add(m[2]);
  }
  return [...adlar];
}

// ─────────────────────────────────────────────────────────────
// Denetim
// ─────────────────────────────────────────────────────────────

export interface IceAktarmaKonusu {
  id: string;
  examScope: string;
  examScopes: readonly string[];
}

export interface IceAktarmaKazanimi {
  id: string;
  topicId: string;
  /** Kayıtlı ad — dosyada farklı ad yazılırsa uyarmak için (isteğe bağlı). */
  name?: string;
}

/** Denetimin dış dünyadan bildikleri. Hepsini çağıran doldurur. */
export interface IceAktarmaBaglami {
  /** YAPRAK konular: konu kodu (slug) → konu. Üst konuya soru bağlanmaz. */
  konular: ReadonlyMap<string, IceAktarmaKonusu>;
  /** Daha önce içe aktarılmış ID'ler (sourceRef "ID · kaynak" biçiminde; ilk parça). */
  mevcutIdler: ReadonlySet<string>;
  /** Havuzdaki TÜM soruların parmak izi → soru kimliği (panelde elle girilenler dahil). */
  mevcutParmakIzleri: ReadonlyMap<string, string>;
  /** Kazanım kodu → kazanım. */
  kazanimlar: ReadonlyMap<string, IceAktarmaKazanimi>;
  /** `![alt](dosya)` ile anılan görsel var mı (klasörde ya da yüklenenler arasında). */
  gorselVar: (dosya: string) => boolean;
  /** İsteğe bağlı: görsel var ama kullanılamıyorsa (bozuk, çok büyük) sebebi. */
  gorselSorunu?: (dosya: string) => string | null;
  /** İsteğe bağlı: formül çizilemiyorsa sebebi (KaTeX). Uyarı üretir, reddetmez. */
  formulHatasi?: (latex: string, blok: boolean) => string | null;
}

/** Yazılmaya hazır, bütün denetimlerden geçmiş soru. */
export interface HazirSoru {
  satir: number;
  id: string;
  topicId: string;
  topicSlug: string;
  stem: QuestionContent;
  stemText: string;
  fingerprint: string;
  solution: QuestionContent | null;
  drafts: ChoiceDraft[];
  /** Şık sırasıyla; doğru şıkta null. */
  errorTypes: (string | null)[];
  difficulty: number;
  targetTimeSeconds: number;
  level: SoruSeviyesi | null;
  kazanimKodu: string | null;
  kazanimAdi: string | null;
  examScopes: SinavKodu[];
  sourceRef: string;
  /** Soru metninde anılan görseller (dosya adı + alternatif metin), yazım sırasıyla. */
  gorseller: { dosya: string; alt: string }[];
}

export interface SoruRaporu {
  /** Dosyadaki sırası (1'den). */
  sira: number;
  satir: number;
  baslik: string;
  /** ID alanı; yazılmamışsa boş. */
  id: string;
  /** Bütün hatalar, denetim sırasıyla. Boşsa soru geçerli. */
  hatalar: string[];
  /** Reddetmeyen ama bakılması gereken noktalar. */
  uyarilar: string[];
  hazir: HazirSoru | null;
  /** Çift kayıt: aynı metnin dosyadaki ilk satırı ya da havuzdaki sorunun kimliği. */
  cift?: { dosyadaSatir?: number; havuzdakiSoruId?: string };
}

export interface DenetimSonucu {
  sorular: SoruRaporu[];
  /** Geçerli sorular, dosya sırasıyla. */
  hazir: HazirSoru[];
}

/** Dosyanın önceki (geçerli) sorularından öğrenilenler. */
interface DosyaIzleri {
  idler: Map<string, number>;
  parmakIzleri: Map<string, number>;
  /** Kod → konusu ve (varsa) ilk yazılan adı. */
  kazanimlar: Map<string, { topicId: string; ad: string | null }>;
}

/** İçerikteki formüller (soru metni, şık, çözüm). */
function formuller(icerik: QuestionContent): { latex: string; blok: boolean }[] {
  const cikti: { latex: string; blok: boolean }[] = [];
  const satirIci = (dugumler: InlineNode[]) => {
    for (const d of dugumler) if (d.type === "math") cikti.push({ latex: d.latex, blok: false });
  };
  for (const b of icerik.blocks) {
    if (b.type === "paragraph") satirIci(b.content);
    else if (b.type === "math_block") cikti.push({ latex: b.latex, blok: true });
    else if (b.type === "list") b.items.forEach(satirIci);
    else if (b.type === "table") {
      b.header?.forEach(satirIci);
      b.rows.forEach((r) => r.forEach(satirIci));
    }
  }
  return cikti;
}

/** Konunun geçtiği sınavlar (examScopes boşsa ana sınav). */
function konuSinavlari(konu: IceAktarmaKonusu): readonly string[] {
  return konu.examScopes.length ? konu.examScopes : [konu.examScope];
}

function soruyuDenetle(q: HamSoru, sira: number, b: IceAktarmaBaglami, dosya: DosyaIzleri): SoruRaporu {
  const a = q.alanlar;
  const id = a["id"] ?? "";
  const hatalar: string[] = [];
  const uyarilar: string[] = [];
  const hata = (sebep: string) => hatalar.push(sebep);
  const uyari = (not: string) => uyarilar.push(not);
  let cift: SoruRaporu["cift"];

  // ── Kimlik ──────────────────────────────────────────────
  if (!id) hata("ID yok.");
  else if (dosya.idler.has(id)) {
    hata("Aynı ID dosyada iki kez geçiyor.");
    cift = { dosyadaSatir: dosya.idler.get(id) };
  } else if (b.mevcutIdler.has(id)) hata("Bu ID daha önce içe aktarılmış.");

  // ── Konu, zorluk, süre ─────────────────────────────────
  const slug = a["konu kodu"] ?? "";
  const konu = b.konular.get(slug);
  if (!konu) hata(slug ? `Konu kodu listede yok: "${slug}".` : "Konu Kodu yazılmamış.");

  const zorluk = Number(a["zorluk"]);
  if (!Number.isInteger(zorluk) || zorluk < 1 || zorluk > 5) {
    hata(a["zorluk"] ? `Zorluk 1-5 arası olmalı (şu an "${a["zorluk"]}").` : "Zorluk yazılmamış (1-5 arası bir sayı).");
  }

  const sure = Number(a["ideal sure"]);
  if (!Number.isInteger(sure) || sure < 10 || sure > 600) {
    hata(
      a["ideal sure"]
        ? `İdeal Süre 10-600 arası tam sayı olmalı (şu an "${a["ideal sure"]}").`
        : "İdeal Süre yazılmamış (10-600 arası saniye)."
    );
  }

  // ── Seviye ve kazanım ──────────────────────────────────
  const seviyeKodu = (a["seviye"] ?? "").trim();
  // hasOwn: "toString" gibi prototip adları seviye sayılmasın.
  const level: SoruSeviyesi | null =
    seviyeKodu && Object.hasOwn(SEVIYELER, seviyeKodu) ? SEVIYELER[seviyeKodu as keyof typeof SEVIYELER] : null;
  if (seviyeKodu && !level) hata(`Seviye 1, 2 veya 3 olmalı (şu an "${seviyeKodu}"). Parantezli açıklama yazma.`);

  const kazanimKodu = (a["kazanim kodu"] ?? "").trim().toUpperCase() || null;
  let kazanimYerinde = true;
  if (level === "L1_TEMEL" && !kazanimKodu) hata("Seviye 1 sorusunda Kazanım Kodu zorunlu.");
  if ((level === "L2_ORTA" || level === "L3_ANALIZ") && kazanimKodu) {
    hata("Seviye 2 ve 3 sorusuna Kazanım Kodu yazılmaz.");
    kazanimYerinde = false;
  }
  const kazanimAdi = (a["kazanim adi"] ?? "").trim() || null;
  if (kazanimKodu && kazanimYerinde) {
    const mevcutKazanim = b.kazanimlar.get(kazanimKodu);
    const dosyadaki = dosya.kazanimlar.get(kazanimKodu);
    // Konu bulunamadıysa karşılaştırma anlamsız; o hata zaten yazıldı.
    if (konu && mevcutKazanim && mevcutKazanim.topicId !== konu.id) {
      hata(`Kazanım "${kazanimKodu}" başka bir konuya ait.`);
    } else if (konu && dosyadaki && dosyadaki.topicId !== konu.id) {
      hata(`Kazanım "${kazanimKodu}" bu dosyada başka bir konuyla tanımlandı.`);
    }
    // Ad yalnızca İLK kullanımda gerekli: sistemde ya da bu dosyada daha önce
    // tanımlandıysa tekrar yazılmaz.
    if (!mevcutKazanim && !dosyadaki && !kazanimAdi) {
      hata(`Kazanım "${kazanimKodu}" sistemde yok; ilk kullanımda Kazanım Adı yazılmalı.`);
    }
    if (kazanimAdi && mevcutKazanim?.name && mevcutKazanim.name !== kazanimAdi) {
      uyari(`Kazanım "${kazanimKodu}" zaten kayıtlı; Kazanım Adı yok sayılır (kayıtlı ad: "${mevcutKazanim.name}").`);
    } else if (kazanimAdi && !mevcutKazanim && dosyadaki?.ad && dosyadaki.ad !== kazanimAdi) {
      uyari(`Kazanım "${kazanimKodu}" bu dosyada başka bir adla tanımlandı; ilk yazılan ad kullanılır.`);
    }
  } else if (kazanimAdi && !kazanimKodu) {
    uyari("Kazanım Adı yazılmış ama Kazanım Kodu yok; ad yok sayılır.");
  }

  // ── Hedef sınav ────────────────────────────────────────
  const yazilanSinavlar = (a["hedef sinav"] ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  let sinavlarGecerli = true;
  for (const s of yazilanSinavlar) {
    if (s === "ORTAK") {
      hata('Hedef Sınav: "ORTAK" diye bir değer yok; alanı boş bırak.');
      sinavlarGecerli = false;
    } else if (!(EXAM_SCOPES as readonly string[]).includes(s)) {
      hata(`Hedef Sınav kodu tanınmıyor: "${s}".`);
      sinavlarGecerli = false;
    }
  }
  const sinavlar = [...new Set(yazilanSinavlar)] as SinavKodu[];

  // ── Soru metni ve görseller ────────────────────────────
  const stemMarkup = a["soru metni"] ?? "";
  const gorseller: HazirSoru["gorseller"] = [];
  let stem: QuestionContent | null = null;
  let turetilen: { stemText: string; fingerprint: string } | null = null;
  if (!stemMarkup.trim()) {
    hata("Soru Metni boş.");
  } else {
    for (const m of stemMarkup.matchAll(GORSEL)) {
      const [, alt, dosyaAdi] = m;
      if (!alt.trim()) hata(`Görsel "${dosyaAdi}" için alternatif metin boş.`);
      else if (!b.gorselVar(dosyaAdi)) hata(`Görsel dosyası bulunamadı: gorseller/${dosyaAdi}`);
      else if (!GORSEL_UZANTILARI.includes(uzanti(dosyaAdi))) hata(`Görsel PNG/JPG/WebP olmalı: ${dosyaAdi}`);
      else {
        const sorun = b.gorselSorunu?.(dosyaAdi);
        if (sorun) hata(`Görsel kullanılamıyor (${dosyaAdi}): ${sorun}`);
        else gorseller.push({ dosya: dosyaAdi, alt: alt.trim() });
      }
    }

    const p = safeParseQuestionContent(markupToContent(stemMarkup));
    if (!p.success) {
      hata("Soru metni çözümlenemedi.");
    } else {
      stem = p.data;
      turetilen = deriveQuestionFields(stem);
      const ilkSatir = dosya.parmakIzleri.get(turetilen.fingerprint);
      if (ilkSatir !== undefined) {
        hata("Aynı soru metni dosyada iki kez geçiyor.");
        cift = { dosyadaSatir: ilkSatir };
      } else if (b.mevcutParmakIzleri.has(turetilen.fingerprint)) {
        hata("Bu soru metni havuzda zaten var (farklı ID ile).");
        cift = { havuzdakiSoruId: b.mevcutParmakIzleri.get(turetilen.fingerprint) };
      }
    }
  }

  // ── Şıklar ─────────────────────────────────────────────
  const secenekler = q.secenekler;
  const dogrular = secenekler.filter((s) => s.isaretli);
  const errorTypes: (string | null)[] = [];
  let drafts: ChoiceDraft[] = [];
  if (secenekler.length < 4) hata(`En az 4 şık gerekli (şu an ${secenekler.length}).`);
  if (secenekler.length > 0) {
    if (dogrular.length === 0) hata("Doğru şık işaretlenmemiş ([x]).");
    else if (dogrular.length > 1) hata(`Birden fazla doğru şık işaretli: ${dogrular.map((d) => d.harf).join(", ")}.`);
    const dogruSatir = (a["dogru sik"] ?? "").trim().toUpperCase();
    if (dogrular.length === 1 && dogruSatir && dogruSatir !== dogrular[0].harf) {
      hata(`[x] ${dogrular[0].harf} şıkkında ama "Doğru Şık" satırı ${dogruSatir} diyor — çelişki.`);
    }
    for (const s of secenekler) {
      if (s.isaretli) {
        errorTypes.push(null);
        if (s.hataKodu) uyari(`Doğru şıkta (${s.harf}) hata kodu yazılmış; yok sayıldı.`);
        continue;
      }
      if (!s.hataKodu) hata(`${s.harf} şıkkında hata kodu yok (satır ${s.satir}).`);
      else if (!(ERROR_TYPES as readonly string[]).includes(s.hataKodu)) hata(`${s.harf} şıkkındaki hata kodu listede yok: ${s.hataKodu}.`);
      errorTypes.push(s.hataKodu);
    }
    drafts = secenekler.map((s, i) => ({
      label: CHOICE_LABELS[i],
      content: markupToContent(s.metin),
      isCorrect: s.isaretli,
    }));
    const harfSirasi = secenekler.every((s, i) => s.harf === CHOICE_LABELS[i]);
    if (!harfSirasi) hata("Şık harfleri A, B, C, … sırasıyla gitmeli.");
    // validateChoices şık sayısını, doğru şıkkı ve harfleri de denetliyor; onlar
    // yukarıda zaten yazıldıysa aynı hatayı ikinci kez söylemesin. Asıl işi:
    // AYNI DEĞERLİ ŞIK (doğru değeri işaretleyen öğrenci yanlış sayılır).
    if (secenekler.length <= 5 && secenekler.length >= 4 && dogrular.length === 1 && harfSirasi) {
      const sikHatalari = validateChoices(drafts);
      if (sikHatalari.length) hata(sikHatalari.join(" "));
    }
  }

  // ── Çözüm ──────────────────────────────────────────────
  let solution: QuestionContent | null = null;
  const cozum = a["cozum aciklamasi"] ?? "";
  if (cozum.trim()) {
    const p = safeParseQuestionContent(markupToContent(cozum));
    if (!p.success) hata("Çözüm metni çözümlenemedi.");
    else solution = p.data;
  } else {
    uyari("Çözüm Açıklaması boş — öğrenci sonuç ekranında çözümü göremez.");
  }

  // ── Sonradan eklenen kurallar (eski betik bunları geçiriyordu) ──
  // Boş şık: içeriği boş blok dizisi olarak kaydediliyor, öğrenci ekranı onu
  // şemadan geçiremiyordu.
  secenekler.forEach((s, i) => {
    if (!safeParseQuestionContent(drafts[i].content).success) {
      hata(drafts[i].content.blocks.length === 0 ? `${s.harf} şıkkının metni boş.` : `${s.harf} şıkkı çözümlenemedi.`);
    }
  });
  // Görsel yalnızca soru metninde: başka yerdeki dosya adı kimliğe çevrilmiyor,
  // öğrenci kırık görsel görürdü.
  const gorselDisarida: [string, string][] = [
    ...secenekler.map((s): [string, string] => [`${s.harf} şıkkında`, s.metin]),
    ["Çözüm Açıklamasında", cozum],
  ];
  for (const [yer, metin] of gorselDisarida) {
    for (const m of metin.matchAll(GORSEL)) {
      hata(`${yer} görsel var (${m[2]}); görsel yalnızca Soru Metni'nde kullanılabilir.`);
    }
  }
  // Hedef sınav konunun sınavlarından olmalı (paneldeki soru formuyla aynı
  // kural): yoksa soru o sınavın testine hiç seçilmez.
  if (konu && sinavlarGecerli && sinavlar.length) {
    const disarida = sinavlar.filter((s) => !konuSinavdaMi(konu, s));
    if (disarida.length) {
      hata(
        `Hedef Sınav: ${disarida.join(", ")} bu konunun sınavlarından değil (konu: ${konuSinavlari(konu).join(", ")}).` +
          (disarida.length === sinavlar.length ? " Soru hiçbir teste seçilmezdi." : "")
      );
    }
  }

  // ── Uyarılar ───────────────────────────────────────────
  for (const [anahtar, bilgi] of Object.entries(q.alanBilgisi)) {
    // hasOwn: "constructor" diye yazılmış bir alan Object'in kendi alanına denk gelmesin.
    if (Object.hasOwn(ESKI_ALANLAR, anahtar)) uyari(ESKI_ALANLAR[anahtar]);
    else if (!BILINEN_ALANLAR.has(anahtar)) uyari(`Tanınmayan alan: "${bilgi.ad}" (satır ${bilgi.satir}) — yok sayıldı.`);
    if (bilgi.kez > 1) uyari(`"${bilgi.ad}" alanı ${bilgi.kez} kez yazılmış; sonuncusu kullanıldı (satır ${bilgi.satir}).`);
  }
  // "Görsel" alanı bilgi amaçlı; görseli ekleyen Soru Metni'ndeki ![…](dosya).
  for (const g of (a["gorsel"] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (![...stemMarkup.matchAll(GORSEL)].some((m) => m[2] === g)) {
      uyari(`Görsel alanında "${g}" yazıyor ama Soru Metni'nde ![…](${g}) yok; görsel soruya eklenmez.`);
    }
  }
  // Şık sayısı: LGS 4 şıklı (A–D), diğer sınavlar 5 şıklı (SORU-SABLONU §1).
  if (konu && sinavlarGecerli && (secenekler.length === 4 || secenekler.length === 5)) {
    const etkin = sinavlar.length ? sinavlar : konuSinavlari(konu);
    if (etkin.length && etkin.every((s) => s === "LGS") && secenekler.length === 5) {
      uyari("LGS sorusu 5 şıklı; LGS'de şıklar A–D.");
    } else if (etkin.length && !etkin.includes("LGS") && secenekler.length === 4) {
      uyari("4 şıklı soru; LGS dışındaki sınavlarda şıklar A–E.");
    }
  }
  // Formüller: KaTeX çizemiyorsa öğrenci kırmızı hata metni görür.
  if (b.formulHatasi) {
    const yerler: [string, QuestionContent | null][] = [
      ["Soru metnindeki", stem],
      ...drafts.map((d): [string, QuestionContent] => [`${d.label} şıkkındaki`, d.content]),
      ["Çözümdeki", solution],
    ];
    let sayi = 0;
    for (const [yer, icerik] of yerler) {
      if (!icerik) continue;
      for (const f of formuller(icerik)) {
        const sebep = b.formulHatasi(f.latex, f.blok);
        if (!sebep) continue;
        // Tek bozuk makro bütün raporu doldurmasın.
        if (++sayi > 3) break;
        uyari(`${yer} formül çizilemiyor: $${f.latex}$ — ${sebep}`);
      }
    }
  }

  if (hatalar.length || !stem || !turetilen || !konu) {
    return { sira, satir: q.satir, baslik: q.baslik, id, hatalar, uyarilar, hazir: null, cift };
  }

  const kaynak = (a["kaynak"] ?? "").trim();
  return {
    sira,
    satir: q.satir,
    baslik: q.baslik,
    id,
    hatalar,
    uyarilar,
    cift,
    hazir: {
      satir: q.satir,
      id,
      topicId: konu.id,
      topicSlug: slug,
      stem,
      stemText: turetilen.stemText,
      fingerprint: turetilen.fingerprint,
      solution,
      drafts,
      errorTypes,
      difficulty: zorluk,
      targetTimeSeconds: sure,
      level,
      kazanimKodu,
      kazanimAdi,
      examScopes: sinavlar,
      sourceRef: kaynak ? `${id} · ${kaynak}` : id,
      gorseller,
    },
  };
}

/**
 * Çözümlenmiş soruları sırayla denetler. Dosya içi çift kayıt (ID, metin)
 * ve kazanım tanımı yalnızca GEÇERLİ sorulardan öğrenilir: reddedilen bir
 * soru, sonrakini "çift" diye düşürmez.
 */
export function dosyayiDenetle(ham: readonly HamSoru[], b: IceAktarmaBaglami): DenetimSonucu {
  const izler: DosyaIzleri = { idler: new Map(), parmakIzleri: new Map(), kazanimlar: new Map() };
  const sorular: SoruRaporu[] = [];
  const hazir: HazirSoru[] = [];

  ham.forEach((q, i) => {
    const r = soruyuDenetle(q, i + 1, b, izler);
    sorular.push(r);
    const h = r.hazir;
    if (!h) return;
    hazir.push(h);
    izler.idler.set(h.id, h.satir);
    izler.parmakIzleri.set(h.fingerprint, h.satir);
    if (h.kazanimKodu) {
      const onceki = izler.kazanimlar.get(h.kazanimKodu);
      if (!onceki) izler.kazanimlar.set(h.kazanimKodu, { topicId: h.topicId, ad: h.kazanimAdi });
      else if (!onceki.ad && h.kazanimAdi) onceki.ad = h.kazanimAdi;
    }
  });

  return { sorular, hazir };
}

// ─────────────────────────────────────────────────────────────
// Yazmaya yardımcılar (veritabanına dokunmadan)
// ─────────────────────────────────────────────────────────────

/**
 * Yeni açılacak kazanımın adı: dosyada o koda yazılan ilk ad. Denetim ilk
 * kullanımda adı zorunlu tuttuğu için normalde hep bulunur.
 */
export function kazanimAdiSec(hazir: readonly HazirSoru[], kod: string): string {
  return hazir.find((x) => x.kazanimKodu === kod && x.kazanimAdi)?.kazanimAdi ?? kod;
}

/**
 * İçerikteki görsel dosya adlarını kayıt kimlikleriyle değiştirir. Yalnızca
 * görsel düğümlerine dokunur: metinde geçen dosya adı olduğu gibi kalır.
 */
export function gorselleriYerlestir(icerik: QuestionContent, kimlikler: ReadonlyMap<string, string>): QuestionContent {
  const satirIci = (dugumler: InlineNode[]): InlineNode[] =>
    dugumler.map((d) => {
      const yeni = d.type === "inline_image" ? kimlikler.get(d.mediaId) : undefined;
      return yeni && d.type === "inline_image" ? { ...d, mediaId: yeni } : d;
    });
  return {
    ...icerik,
    blocks: icerik.blocks.map((b) => {
      if (b.type === "paragraph") return { ...b, content: satirIci(b.content) };
      if (b.type === "image") {
        const yeni = kimlikler.get(b.mediaId);
        return yeni ? { ...b, mediaId: yeni } : b;
      }
      if (b.type === "list") return { ...b, items: b.items.map(satirIci) };
      if (b.type === "table") {
        return { ...b, ...(b.header ? { header: b.header.map(satirIci) } : {}), rows: b.rows.map((r) => r.map(satirIci)) };
      }
      return b;
    }),
  };
}

/** Bu dosyadaki seviye 1 sorularının kazanım başına sayısı (ilk geçiş sırasıyla). */
export function seviye1Sayilari(hazir: readonly HazirSoru[]): Map<string, number> {
  const sayac = new Map<string, number>();
  for (const q of hazir) {
    if (q.level === "L1_TEMEL" && q.kazanimKodu) sayac.set(q.kazanimKodu, (sayac.get(q.kazanimKodu) ?? 0) + 1);
  }
  return sayac;
}

/**
 * Tek seviye-1 sorusu kalan kazanımlar: telafi turu aynı kazanımı FARKLI bir
 * soruyla sorar, yedeği yoksa o kazanım telafide boş kalır (SORU-SABLONU §3).
 * `havuzda`: kazanım kodu → havuzdaki seviye 1 soru sayısı.
 */
export function tekSoruluKazanimlar(dosyada: ReadonlyMap<string, number>, havuzda: ReadonlyMap<string, number>): string[] {
  return [...dosyada].filter(([kod, n]) => n + (havuzda.get(kod) ?? 0) < 2).map(([kod]) => kod);
}
