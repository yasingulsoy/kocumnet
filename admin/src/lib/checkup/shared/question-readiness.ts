// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/question-readiness.ts · eşitlemek için: npm run checkup:sync

/**
 * "Yayına hazır mı?" — sorunun yayın denetim listesi, TEK kural (saf modül).
 *
 * Soru yayına girerken bu liste KAPIDIR. Aynı fonksiyonu çağıranlar:
 *   · panelin soru formu (canlı liste ve kayıt), listedeki durum seçici,
 *     toplu durum değiştirme, inceleme kuyruğunun "Onayla"sı
 *   · toplu içe aktarmanın "doğrudan yayına al"ı (lib/question-import.ts:
 *     hazır olmayan soru İncelemede girer)
 * Biri geçirip öteki reddetmesin diye kural burada; panel bu dosyanın
 * kopyasını kullanır (admin/scripts/checkup-sync.mjs), yalnızca göreli ve
 * paket importu.
 *
 * Taslakta eksik serbest: yazar yarım soruyu kaydedebilsin, hata tipini
 * sonra seçsin. Yayın için hepsi gerekli, çünkü öğrenci yayındaki soruyu
 * görür: çözümsüz soru yanlışını öğretemez, hata tipsiz çeldirici teşhise
 * katılmaz, seviyesiz soru seviyeli check-up'a girmez, çizilemeyen formül
 * öğrenciye kırmızı hata metni olarak görünür.
 *
 * Kural yalnızca YAYINA GİRİŞTE uygulanır. Zaten yayında olan eski bir soru
 * eksikse düzeltme kaydı reddedilmez (eksiklerini düzeltmek için açılmış
 * olabilir); panel yalnızca o kayıtla YENİ bir eksik açılmasını engeller.
 *
 * ⚠️ İstemciye alınamaz: question-content parmak izi için node:crypto
 * kullanıyor. Panelin formu canlı listeyi bir sunucu eyleminden alır.
 */
import katex from "katex";
import { ERROR_TYPES } from "./error-types";
import { latexCizimi } from "./question-markup";
import {
  CHOICE_LABELS,
  containsStepBreak,
  safeParseQuestionContent,
  splitSolutionSteps,
  validateChoices,
  type ChoiceDraft,
  type InlineNode,
  type QuestionContent,
} from "./question-content";

// ─────────────────────────────────────────────────────────────
// Maddeler
// ─────────────────────────────────────────────────────────────

/** Eksik kodları; sıra denetim listesinin sırası. */
export const EKSIK_KODLARI = ["metin", "cozum", "hata_tipi", "seviye", "kazanim", "formul", "siklar", "sik_sayisi"] as const;
export type EksikKodu = (typeof EKSIK_KODLARI)[number];

export interface Eksik {
  kod: EksikKodu;
  /** Sade cümle: "B ve D şıklarında hata tipi seçilmemiş." */
  mesaj: string;
}

export interface KontrolMaddesi {
  kod: EksikKodu;
  /** Maddenin adı, olumlu cümle: "Çözüm yazıldı". */
  baslik: string;
  tamam: boolean;
  /** Eksikse ne eksik. */
  mesaj?: string;
  /** Bu soruya uygulanmıyor (ör. seviye 2 sorusunda kazanım): tamam sayılır, soluk görünür. */
  ilgisiz?: boolean;
}

export interface Hazirlik {
  hazir: boolean;
  eksikler: Eksik[];
  /** Denetim listesinin bütün maddeleri (geçenler de): formdaki canlı liste. */
  maddeler: KontrolMaddesi[];
}

/** Toplu işlemin özeti için kısa adlar: "3 soru atlandı: çözüm yok (2), hata tipi eksik (1)". */
export const EKSIK_KISA: Record<EksikKodu, string> = {
  metin: "soru metni okunamıyor",
  cozum: "çözüm yok",
  hata_tipi: "hata tipi eksik",
  seviye: "seviye yok",
  kazanim: "kazanım yok",
  formul: "formül çizilemiyor",
  siklar: "şıklarda sorun var",
  sik_sayisi: "şık sayısı sınava uymuyor",
};

const BASLIK: Record<EksikKodu, string> = {
  metin: "Soru metni okunuyor",
  cozum: "Çözüm yazıldı",
  hata_tipi: "Her yanlış şıkta hata tipi var",
  seviye: "Seviye seçildi",
  kazanim: "Seviye 1 sorusunda kazanım var",
  formul: "Formüller çiziliyor",
  siklar: "Şıklar geçerli ve birbirinden farklı",
  sik_sayisi: "Şık sayısı sınava uygun",
};

const SEVIYELER: readonly string[] = ["L1_TEMEL", "L2_ORTA", "L3_ANALIZ"];

// ─────────────────────────────────────────────────────────────
// Girdi
// ─────────────────────────────────────────────────────────────

export interface HazirlikSorusu {
  /** Blok dizisi. Veritabanındaki Json olduğu gibi verilebilir: şemadan burada geçer. */
  stem: unknown;
  /** Çözüm blok dizisi; yoksa null. */
  solution: unknown;
  /** İpuçları (blok dizilerinin listesi); yoksa null. */
  hints?: unknown;
  /** Şıklar gösterim sırasıyla (sortOrder); etiketler A'dan verilir. */
  choices: readonly { content: unknown; isCorrect: boolean; errorType: string | null | undefined }[];
  level: string | null | undefined;
  /** Bağlı kazanım; yoksa null. Arşivdeki kazanımı seviye 1 seçmez. */
  kazanim: { arsivde: boolean } | null;
  /** Sorunun hedef sınavları (Question.examScopes); boş = konunun her sınavı. */
  examScopes: readonly string[];
  /** Konunun sınavları; bilinmiyorsa null (şık sayısı denetlenmez). */
  konu: { examScope: string; examScopes: readonly string[] } | null;
}

// ─────────────────────────────────────────────────────────────
// Yardımcılar (içe aktarma da kullanıyor)
// ─────────────────────────────────────────────────────────────

/** "A", "A ve C", "A, C ve D". */
function harfler(liste: readonly string[]): string {
  return liste.length <= 1 ? liste.join("") : liste.slice(0, -1).join(", ") + " ve " + liste[liste.length - 1];
}

/**
 * Formül öğrencinin ekranında KaTeX'le çiziliyor (app/components/MathContent.tsx,
 * throwOnError: false → hatalı formül kırmızı kaynak metin olarak görünür).
 * Aynı seçeneklerle ve aynı çizim dönüşümüyle (latexCizimi), hatayı yakalayarak
 * deniyoruz: burada hata veren formül öğrencide de kırmızı çıkar.
 */
export function formulHatasi(latex: string, blok: boolean): string | null {
  try {
    katex.renderToString(latexCizimi(latex), { displayMode: blok, throwOnError: true, strict: "ignore", output: "html" });
    return null;
  } catch (e) {
    return (e instanceof Error ? e.message : String(e)).replace(/^KaTeX parse error:\s*/, "");
  }
}

/** İçerikteki formüller (paragraf, blok formül, öncül listesi, tablo). */
export function icerikFormulleri(icerik: QuestionContent): { latex: string; blok: boolean }[] {
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

/** Sorunun girebileceği sınavlar: kendi listesi doluysa o, boşsa konusunun sınavları (shared/exam-scope.ts ile aynı tanım). */
export function etkinSinavlar(
  examScopes: readonly string[],
  konu: { examScope: string; examScopes: readonly string[] } | null
): readonly string[] {
  if (examScopes.length) return examScopes;
  if (!konu) return [];
  return konu.examScopes.length ? konu.examScopes : [konu.examScope];
}

/**
 * Şık sayısı sınava uyuyor mu: LGS 4 şıklı (A–D), öteki sınavlar 5 şıklı
 * (SORU-SABLONU §1). Hem LGS'de hem başka sınavda sorulabilen soru iki
 * sayıyla da geçer. Uymuyorsa sebep cümlesi (içe aktarmanın uyarısıyla aynı).
 */
export function sikSayisiSorunu(sinavlar: readonly string[], sikSayisi: number): string | null {
  if (!sinavlar.length || (sikSayisi !== 4 && sikSayisi !== 5)) return null;
  if (sikSayisi === 5 && sinavlar.every((s) => s === "LGS")) return "LGS sorusu 5 şıklı; LGS'de şıklar A–D.";
  if (sikSayisi === 4 && !sinavlar.includes("LGS")) return "4 şıklı soru; LGS dışındaki sınavlarda şıklar A–E.";
  return null;
}

function icerik(deger: unknown): QuestionContent | null {
  if (deger == null) return null;
  const p = safeParseQuestionContent(deger);
  return p.success ? p.data : null;
}

// ─────────────────────────────────────────────────────────────
// Kural
// ─────────────────────────────────────────────────────────────

export function yayinaHazirMi(soru: HazirlikSorusu): Hazirlik {
  const maddeler: KontrolMaddesi[] = [];
  const madde = (kod: EksikKodu, mesaj: string | null, ilgisiz = false) =>
    maddeler.push({ kod, baslik: BASLIK[kod], tamam: mesaj === null, ...(mesaj ? { mesaj } : {}), ...(ilgisiz ? { ilgisiz } : {}) });

  // ── Soru metni: kayıt yolları zaten denetliyor; elle bozulmuş satıra karşı.
  // Geçiyorsa listede gösterilmez (her soruda hep yeşil, gürültü).
  const stem = icerik(soru.stem);
  if (!stem || stem.blocks.length === 0 || containsStepBreak(stem)) madde("metin", "Soru metni okunamıyor.");

  // ── Çözüm: boş adımlar (yalnızca ayırıcı ya da boşluk) çözüm sayılmaz.
  const cozum = icerik(soru.solution);
  madde("cozum", cozum && splitSolutionSteps(cozum).length > 0 ? null : "Çözüm yazılmamış.");

  // ── Şıklar: içerik, etiket, doğru şık.
  const okunan = soru.choices.map((c, i) => ({ ...c, etiket: CHOICE_LABELS[i] ?? String(i + 1), icerik: icerik(c.content) }));

  // ── Hata tipi: her yanlış şıkta listedeki bir tip. Doğru şıkta aranmaz.
  const tipsiz = okunan
    .filter((c) => !c.isCorrect && !(c.errorType && (ERROR_TYPES as readonly string[]).includes(c.errorType)))
    .map((c) => c.etiket);
  madde(
    "hata_tipi",
    tipsiz.length === 0 ? null : harfler(tipsiz) + (tipsiz.length === 1 ? " şıkkında" : " şıklarında") + " hata tipi seçilmemiş."
  );

  // ── Seviye ve kazanım.
  const seviye = soru.level && SEVIYELER.includes(soru.level) ? soru.level : null;
  madde("seviye", seviye ? null : "Seviye seçilmemiş.");
  if (seviye === "L1_TEMEL") {
    madde(
      "kazanim",
      !soru.kazanim
        ? "Seviye 1 sorusunun kazanımı seçilmemiş."
        : soru.kazanim.arsivde
          ? "Kazanımı arşivde: seviye 1 arşivdeki kazanımı sormaz."
          : null
    );
  } else {
    madde("kazanim", null, true);
  }

  // ── Formüller: soru metni, şıklar, çözüm, ipuçları. İlk ikisi yazılır.
  const ipuclari = Array.isArray(soru.hints) ? soru.hints.map(icerik).filter((h): h is QuestionContent => h !== null) : [];
  const yerler: [string, QuestionContent | null][] = [
    ["soru metninde", stem],
    ...okunan.map((c): [string, QuestionContent | null] => [c.etiket + " şıkkında", c.icerik]),
    ["çözümde", cozum],
    ...ipuclari.map((h, i): [string, QuestionContent] => [i + 1 + ". ipucunda", h]),
  ];
  const bozuk: string[] = [];
  for (const [yer, ic] of yerler) {
    if (!ic) continue;
    for (const f of icerikFormulleri(ic)) {
      if (formulHatasi(f.latex, f.blok)) bozuk.push("$" + f.latex + "$ (" + yer + ")");
    }
  }
  madde(
    "formul",
    bozuk.length === 0
      ? null
      : (bozuk.length === 1 ? "Formül çizilemiyor: " : bozuk.length + " formül çizilemiyor: ") +
          bozuk.slice(0, 2).join(", ") +
          (bozuk.length > 2 ? " …" : "") +
          "."
  );

  // ── Şıklar: validateChoices (4-5 şık, tek doğru, sıralı etiket, AYNI DEĞERLİ ŞIK yok).
  const okunamayan = okunan.filter((c) => !c.icerik || c.icerik.blocks.length === 0).map((c) => c.etiket);
  if (okunamayan.length) {
    madde("siklar", harfler(okunamayan) + (okunamayan.length === 1 ? " şıkkı boş ya da okunamıyor." : " şıkları boş ya da okunamıyor."));
  } else {
    const taslak: ChoiceDraft[] = okunan.map((c) => ({ label: c.etiket, content: c.icerik!, isCorrect: c.isCorrect }));
    const hatalar = validateChoices(taslak);
    madde("siklar", hatalar.length ? hatalar.join(" ") : null);
  }

  // ── Şık sayısı sınavla uyumlu (LGS 4, diğerleri 5).
  if (soru.konu || soru.examScopes.length) {
    madde("sik_sayisi", sikSayisiSorunu(etkinSinavlar(soru.examScopes, soru.konu), soru.choices.length));
  } else {
    madde("sik_sayisi", null, true);
  }

  const eksikler = maddeler.filter((m) => !m.tamam).map((m) => ({ kod: m.kod, mesaj: m.mesaj ?? BASLIK[m.kod] }));
  return { hazir: eksikler.length === 0, eksikler, maddeler };
}

/** Eksiklerin tek cümlelik özeti: "Yayına alınamaz: çözüm yok, hata tipi eksik." */
export function eksikOzeti(eksikler: readonly Eksik[]): string {
  return "Yayına alınamaz: " + eksikler.map((e) => EKSIK_KISA[e.kod]).join(", ") + ".";
}
