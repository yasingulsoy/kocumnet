// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/question-content.ts · eşitlemek için: npm run checkup:sync

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

/**
 * Çözüm adımlarının ayırıcısı (yazım biçiminde tek başına `---` satırı).
 * YALNIZCA çözümde anlamlı: öğrenci çözümü adım adım açar. Soru metninde ve
 * şıkta yasak (containsStepBreak ile denetlenir).
 */
const stepBreakBlock = z.object({ type: z.literal("step_break") });

const block = z.discriminatedUnion("type", [
  paragraphBlock,
  mathBlock,
  imageBlock,
  tableBlock,
  listBlock,
  spacerBlock,
  stepBreakBlock,
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
      case "step_break":
        break;
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Çözüm adımları
// ─────────────────────────────────────────────────────────────

export function containsStepBreak(content: QuestionContent): boolean {
  return content.blocks.some((b) => b.type === "step_break");
}

/**
 * Çözümü adımlara böler. Ayırıcı yoksa tek adım döner; boş adımlar (art arda
 * iki ayırıcı, baştaki/sondaki ayırıcı) atılır.
 */
export function splitSolutionSteps(content: QuestionContent): QuestionContent[] {
  const steps: QuestionContent[] = [];
  let current: ContentBlock[] = [];
  const flush = () => {
    if (current.some((b) => b.type !== "spacer")) steps.push({ version: 1, blocks: current });
    current = [];
  };
  for (const b of content.blocks) {
    if (b.type === "step_break") flush();
    else current.push(b);
  }
  flush();
  return steps;
}

// ─────────────────────────────────────────────────────────────
// Kademeli ipuçları
// ─────────────────────────────────────────────────────────────

/** Bir soruda en fazla kaç ipucu. Daha fazlası çözümün kendisi olur. */
export const MAX_HINTS = 3;

/**
 * Question.hints: blok dizilerinden oluşan liste. İpucunda adım ayırıcı
 * olamaz; her ipucu tek parça açılır.
 */
export const hintsSchema = z
  .array(questionContentSchema)
  .max(MAX_HINTS, `En fazla ${MAX_HINTS} ipucu olabilir`)
  .refine((list) => list.every((h) => !containsStepBreak(h)), "İpucunda adım ayırıcı (---) olamaz");

/**
 * Veritabanındaki ipuçlarını okur. Bozuk satır sayfayı düşürmesin diye hata
 * fırlatmaz, boş liste döner; kaydetme yolları hintsSchema.parse kullanır.
 */
export function parseHints(value: unknown): QuestionContent[] {
  if (value == null) return [];
  const r = hintsSchema.safeParse(value);
  return r.success ? r.data : [];
}

// ─────────────────────────────────────────────────────────────
// Video çözüm bağlantısı
// ─────────────────────────────────────────────────────────────

export interface VideoRef {
  provider: "youtube" | "vimeo";
  id: string;
  /** Gömülü oynatıcı adresi: YouTube çerezsiz alan adı, Vimeo dnt=1. */
  embedUrl: string;
  /** Kayıtta saklanan biçim. */
  canonicalUrl: string;
}

/**
 * Yalnızca YouTube ve Vimeo kabul edilir: başka bir adresi iframe'e koymak,
 * sınav ekranına herhangi bir siteyi gömmek demek. Desteklenen biçimler:
 * youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, youtube.com/embed/…,
 * vimeo.com/123, player.vimeo.com/video/123. Başlangıç saniyesi (t=) korunur.
 */
export function parseVideoUrl(raw: string | null | undefined): VideoRef | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");

  const baslangic = (() => {
    const t = u.searchParams.get("t") ?? u.searchParams.get("start");
    if (!t) return 0;
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
    if (!m) return 0;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  })();

  let ytId: string | null = null;
  if (host === "youtu.be") ytId = u.pathname.slice(1).split("/")[0] || null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") ytId = u.searchParams.get("v");
    else {
      const m = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname);
      ytId = m?.[1] ?? null;
    }
  }
  if (ytId) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(ytId)) return null;
    const s = baslangic > 0 ? `?start=${baslangic}` : "";
    return {
      provider: "youtube",
      id: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}${s}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${ytId}${baslangic > 0 ? `&t=${baslangic}` : ""}`,
    };
  }

  let vimeoId: string | null = null;
  if (host === "vimeo.com") vimeoId = /^\/(\d+)/.exec(u.pathname)?.[1] ?? null;
  else if (host === "player.vimeo.com") vimeoId = /^\/video\/(\d+)/.exec(u.pathname)?.[1] ?? null;
  if (vimeoId) {
    return {
      provider: "vimeo",
      id: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?dnt=1`,
      canonicalUrl: `https://vimeo.com/${vimeoId}`,
    };
  }
  return null;
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

  for (const c of choices) {
    if (containsStepBreak(c.content)) errors.push(`${c.label} şıkkında adım ayırıcı (---) olamaz.`);
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
