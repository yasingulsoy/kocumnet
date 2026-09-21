import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Soru gövdesinin blok şeması (PLAN §3).
 *
 * Formüller LaTeX KAYNAĞI olarak saklanır, görsel olarak değil: yazı boyutuna
 * uyar, ekran okuyucu okur, kopyalanabilir, aranabilir. Görsel olarak saklansa
 * mobilde bulanıklaşır ve karanlık temada ters döner.
 *
 * İstisna: geometri şekilleri ve grafikler → `image` bloğu.
 */

// ─────────────────────────────────────────────────────────────
// Satır içi düğümler
// ─────────────────────────────────────────────────────────────

const textNode = z.object({
  type: z.literal("text"),
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  sub: z.boolean().optional(),
  sup: z.boolean().optional(),
});

const mathNode = z.object({
  type: z.literal("math"),
  latex: z.string().min(1, "LaTeX boş olamaz"),
});

const inlineImageNode = z.object({
  type: z.literal("inline_image"),
  mediaId: z.string().min(1),
  alt: z.string().min(1, "alt metni zorunlu — ekran okuyucu bunu okur"),
});

const inlineNode = z.discriminatedUnion("type", [textNode, mathNode, inlineImageNode]);
const inlineContent = z.array(inlineNode);

// ─────────────────────────────────────────────────────────────
// Bloklar
// ─────────────────────────────────────────────────────────────

const paragraphBlock = z.object({
  type: z.literal("paragraph"),
  content: inlineContent,
});

const mathBlock = z.object({
  type: z.literal("math_block"),
  latex: z.string().min(1, "LaTeX boş olamaz"),
});

const imageBlock = z.object({
  type: z.literal("image"),
  mediaId: z.string().min(1),
  alt: z.string().min(1, "alt metni zorunlu — ekran okuyucu bunu okur"),
  caption: z.string().optional(),
});

const tableBlock = z.object({
  type: z.literal("table"),
  header: z.array(inlineContent).optional(),
  rows: z.array(z.array(inlineContent)).min(1),
});

/** "roman" → I, II, III öncülleri; ÖSYM formatının vazgeçilmezi. */
const listBlock = z.object({
  type: z.literal("list"),
  style: z.enum(["roman", "bullet", "ordered"]).default("roman"),
  items: z.array(inlineContent).min(1),
});

const spacerBlock = z.object({ type: z.literal("spacer") });

const block = z.discriminatedUnion("type", [
  paragraphBlock,
  mathBlock,
  imageBlock,
  tableBlock,
  listBlock,
  spacerBlock,
]);

export const questionContentSchema = z.object({
  version: z.literal(1),
  blocks: z.array(block).min(1, "En az bir blok gerekli"),
});

export type InlineNode = z.infer<typeof inlineNode>;
export type ContentBlock = z.infer<typeof block>;
export type QuestionContent = z.infer<typeof questionContentSchema>;

/**
 * Veritabanından gelen Json'ı doğrular.
 * Prisma `Json` alanını `unknown` olarak verir; şemadan geçmeden kullanmak,
 * elle düzenlenmiş bir satırın render sırasında sayfayı düşürmesi demektir.
 */
export function parseQuestionContent(value: unknown): QuestionContent {
  return questionContentSchema.parse(value);
}

export function safeParseQuestionContent(value: unknown) {
  return questionContentSchema.safeParse(value);
}

// ─────────────────────────────────────────────────────────────
// Düz metin izdüşümü
// ─────────────────────────────────────────────────────────────

function inlineToText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.text;
        // LaTeX metne dahil: aynı cümleyi kuran ama sayıları farklı iki soru
        // birbirinin kopyası sayılmamalı.
        case "math":
          return node.latex;
        case "inline_image":
          return node.alt;
      }
    })
    .join("");
}

/**
 * `stemText` — tam metin arama, çift kayıt tespiti ve admin listelerinde
 * önizleme için (PLAN §3).
 */
export function extractText(content: QuestionContent): string {
  const parts: string[] = [];

  for (const b of content.blocks) {
    switch (b.type) {
      case "paragraph":
        parts.push(inlineToText(b.content));
        break;
      case "math_block":
        parts.push(b.latex);
        break;
      case "image":
        parts.push(b.caption ? `${b.alt} ${b.caption}` : b.alt);
        break;
      case "table":
        if (b.header) parts.push(b.header.map(inlineToText).join(" "));
        for (const row of b.rows) parts.push(row.map(inlineToText).join(" "));
        break;
      case "list":
        for (const item of b.items) parts.push(inlineToText(item));
        break;
      case "spacer":
        break;
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Parmak izi
// ─────────────────────────────────────────────────────────────

/**
 * Çift kayıt tespiti için normalize edilmiş özet (Question.fingerprint, UNIQUE).
 *
 * Aynı soru iki kez girilirse istatistik ikiye bölünür ve öğrenci aynı soruyu
 * iki kez görür — ikisi de sessizce olur. Bu yüzden veritabanı seviyesinde
 * engelleniyor, içe aktarma hatayı yüzeye çıkarıyor.
 *
 * Normalizasyon boşluk ve büyük/küçük harf farkını yutar; SAYILARI ve LaTeX'i
 * yutmaz — "3 saat" ile "5 saat" farklı sorulardır.
 */
export function fingerprint(stemText: string): string {
  const normalized = stemText
    .normalize("NFKC")
    .toLocaleLowerCase("tr")
    // LaTeX'te anlamsız boşluk varyasyonları: "x + 1" ile "x+1" aynı soru.
    .replace(/\s+/g, "")
    // Tırnak/tire varyantlarını tekilleştir (Word'den yapıştırılan metinler).
    .replace(/[‘’“”]/g, "'")
    .replace(/[‐-―]/g, "-");

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/** Kaydetmeden önce türetilen alanları tek yerden üret. */
export function deriveQuestionFields(stem: QuestionContent) {
  const stemText = extractText(stem);
  return { stemText, fingerprint: fingerprint(stemText) };
}

// ─────────────────────────────────────────────────────────────
// Şık doğrulaması
// ─────────────────────────────────────────────────────────────

export interface ChoiceDraft {
  label: string;
  content: QuestionContent;
  isCorrect: boolean;
}

export const CHOICE_LABELS = ["A", "B", "C", "D", "E"] as const;

/**
 * Soru kaydedilmeden önce şıklar denetlenir. Hata listesi döner (boşsa geçerli).
 *
 * En sinsi kural AYNI DEĞERLİ ŞIK yasağı: çeldirici formülü doğru cevapla
 * aynı sonucu verdiğinde (ör. kalan 0 iken "kalan-1" de 0 çıkıyor) iki özdeş
 * şık oluşur. Öğrenci doğru değeri işaretler ama "yanlış" sayılır — üstelik
 * ekranda hiçbir şey ters görünmez. Bu ancak makine denetimiyle yakalanır.
 */
export function validateChoices(choices: ChoiceDraft[]): string[] {
  const errors: string[] = [];

  if (choices.length < 4 || choices.length > 5) {
    errors.push(`Şık sayısı 4 veya 5 olmalı (şu an ${choices.length}).`);
  }

  const correct = choices.filter((c) => c.isCorrect);
  if (correct.length === 0) errors.push("Doğru şık işaretlenmemiş.");
  if (correct.length > 1) {
    errors.push(`Birden fazla doğru şık var (${correct.map((c) => c.label).join(", ")}).`);
  }

  const labels = choices.map((c) => c.label);
  const expected = CHOICE_LABELS.slice(0, choices.length);
  if (labels.join(",") !== expected.join(",")) {
    errors.push(`Şık etiketleri ${expected.join(", ")} olmalı (şu an ${labels.join(", ")}).`);
  }

  const seen = new Map<string, string>();
  for (const c of choices) {
    const key = fingerprint(extractText(c.content));
    const first = seen.get(key);
    if (first) {
      errors.push(
        `${first} ve ${c.label} şıkları aynı değere sahip — biri doğruysa diğerini ` +
          `işaretleyen öğrenci haksız yere yanlış sayılır.`
      );
    } else {
      seen.set(key, c.label);
    }
  }

  return errors;
}
