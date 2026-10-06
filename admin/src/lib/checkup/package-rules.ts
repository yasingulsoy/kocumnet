/**
 * Paket düzenleme kuralları — saf modül. Paket düzenleyici (istemci) ve
 * kaydetme (sunucu) aynı sınırları kullanır; sunucu her kuralı yeniden
 * denetler, istemcideki yalnızca anında geri bildirim içindir.
 */

/**
 * ⚠️ PAKET TASARIMININ TEK KURALI: bir pakette bir konuya EN AZ 3 soru.
 * Tek ya da iki soruyla konu seviyesi ölçülemez (puanlama o konuya seviye
 * vermez). app/prisma/seed.ts'teki MIN_PER_TOPIC ile aynı — seed paketlerinde
 * de, panelde açılan paketlerde de aynı kural.
 */
export const MIN_PER_TOPIC = 3;
/** Bir konuya en fazla — 30 sorudan sonrası konu taraması değil deneme olur. */
export const MAX_PER_TOPIC = 30;
/** Bir pakette en fazla konu. Kapsam istiyorsan konu değil paket sayısını artır. */
export const MAX_KONU = 12;

export const AD_SINIR = { min: 3, max: 80 } as const;
export const OZET_SINIR = 300;
/** Dakika. Paket süresi test başlarken oturuma kopyalanır. */
export const SURE_SINIR = { min: 5, max: 180 } as const;

/** Kalıcı adres parçası: küçük harf, rakam, tire. Paket oluşturulduktan sonra değişmez. */
export const SLUG_KALIBI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_SINIR = { min: 3, max: 60 } as const;

// tr-TR küçültmesinden sonra (İ → i, I → ı) kalan Türkçe harfler.
const TR_HARF: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "TYT Üçgenler ve Çokgenler" → "tyt-ucgenler-ve-cokgenler". Yalnızca öneri; yazar değiştirebilir. */
export function slugOner(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (h) => TR_HARF[h] ?? h)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_SINIR.max)
    .replace(/-+$/g, "");
}

/**
 * Seçimin bir konudan istediği zorluk dağılımı: kolay %30 · orta %50 · zor %20
 * (app/lib/question-selection.ts bandTargets ile aynı yuvarlama). Bant
 * yetmezse seçim gevşer ve testin zorluğu kayar — engel değil, uyarı.
 */
export function bandTargets(total: number): { easy: number; medium: number; hard: number } {
  const easy = Math.round(total * 0.3);
  const hard = Math.round(total * 0.2);
  return { easy, medium: Math.max(0, total - easy - hard), hard };
}

/** Bir konunun havuzu: istenenden azsa paket başlamaz; iki katından azsa ikinci çözümde soru tekrar eder. */
export type KonuHavuzu = "ready" | "narrow" | "blocked";

export function konuHavuzu(have: number, need: number): KonuHavuzu {
  if (have < need) return "blocked";
  if (have < need * 2) return "narrow";
  return "ready";
}

/** (sınav, konu) başına paketin çekebileceği yayındaki soru ve zorluk bantları. */
export interface HavuzSayisi {
  have: number;
  easy: number;
  medium: number;
  hard: number;
}
