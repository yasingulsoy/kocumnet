// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/question-markup.ts · eşitlemek için: npm run checkup:sync

import type { ContentBlock, InlineNode, QuestionContent } from "./question-content";

/**
 * Yazım biçimi ⇄ blok dizisi.
 *
 * Soru gövdesi veritabanında JSONB blok dizisi olarak duruyor (PLAN §3), ama
 * kimse soru girerken JSON yazmaz. Aradaki köprü bu: öğretmen düz metin yazar,
 * formülleri `$...$` içine alır — matematikçilerin zaten bildiği gösterim.
 *
 *   Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor.
 *   $$x = v \cdot t$$
 *   ![Hız-zaman grafiği](cmu9...)
 *   - $x$ tek sayıdır
 *   - $y$ çift sayıdır
 *
 * Çift yönlü: mevcut bir soruyu düzenlemek için bloklar tekrar metne çevrilir.
 * Round-trip bozulursa düzenleme sessizce içerik kaybeder — smoke testi bunu
 * denetliyor.
 */

const ESCAPED_DOLLAR = "\u0000ESCDOLLAR\u0000";

/**
 * Satır içi belirteçler: görsel `![alt](id)` veya formül `$...$`.
 * Tek bir taramada ikisini de yakalıyoruz; ayrı ayrı taramak iç içe
 * durumlarda (formül içinde köşeli parantez gibi) yanlış bölerdi.
 */
const TOKEN = /!\[([^\]]*)\]\(([^)\s]+)\)|\$([^$]+)\$/g;

function restore(s: string) {
  return s.replaceAll(ESCAPED_DOLLAR, "$");
}

/** Satır içi metni belirteç sınırlarından düğümlere ayırır. */
function parseInline(raw: string): InlineNode[] {
  const text = raw.replaceAll("\\$", ESCAPED_DOLLAR);
  const nodes: InlineNode[] = [];
  let cursor = 0;

  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", text: restore(text.slice(cursor, match.index)) });
    }

    const [, alt, mediaId, latex] = match;
    if (mediaId) {
      nodes.push({ type: "inline_image", mediaId, alt: restore(alt) || "Görsel" });
    } else if (latex) {
      const kaynak = restore(latex).trim();
      if (kaynak) nodes.push({ type: "math", latex: kaynak });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push({ type: "text", text: restore(text.slice(cursor)) });
  }

  return nodes.filter((n) => n.type !== "text" || n.text.length > 0);
}

/** Tek başına bir satırda duran görsel → blok görsel. */
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function markupToContent(markup: string): QuestionContent {
  const blocks: ContentBlock[] = [];
  const lines = markup.replace(/\r\n/g, "\n").split("\n");

  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = parseInline(paragraph.join(" ").trim());
    if (content.length) blocks.push({ type: "paragraph", content });
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({
      type: "list",
      style: "roman", // ÖSYM'nin I, II, III öncül biçimi varsayılan
      items: listItems.map(parseInline),
    });
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Tek başına $$...$$ → blok formül
    const display = trimmed.match(/^\$\$(.+)\$\$$/);
    if (display) {
      flushParagraph();
      flushList();
      blocks.push({ type: "math_block", latex: display[1].trim() });
      continue;
    }

    // Tek başına ![alt](id) → blok görsel (geometri şekli, grafik)
    const image = trimmed.match(IMAGE_LINE);
    if (image) {
      flushParagraph();
      flushList();
      blocks.push({ type: "image", mediaId: image[2], alt: image[1] || "Görsel" });
      continue;
    }

    // "- " ile başlayan ardışık satırlar → öncül listesi
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return { version: 1, blocks };
}

function inlineToMarkup(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "math") return "$" + n.latex + "$";
      if (n.type === "inline_image") return "![" + n.alt + "](" + n.mediaId + ")";
      return n.text.replaceAll("$", "\\$");
    })
    .join("");
}

export function contentToMarkup(content: QuestionContent): string {
  const parts: string[] = [];

  for (const block of content.blocks) {
    switch (block.type) {
      case "paragraph":
        parts.push(inlineToMarkup(block.content));
        break;
      case "math_block":
        parts.push("$$" + block.latex + "$$");
        break;
      case "image":
        parts.push("![" + block.alt + "](" + block.mediaId + ")");
        break;
      case "list":
        parts.push(block.items.map((i) => "- " + inlineToMarkup(i)).join("\n"));
        break;
      case "table":
        // Tablo yazım biçiminde temsil edilmiyor; düzenleme hasUneditableBlocks
        // ile engelleniyor, bu satıra normalde hiç gelinmez.
        parts.push("[tablo — bu biçimde düzenlenemez]");
        break;
      case "spacer":
        break;
    }
  }

  return parts.join("\n\n");
}

/**
 * Metne çevrilince geri dönüşü bozulacak bloklar var mı?
 * Varsa düzenleme formu kaydetmeye izin VERMEMELİ — yoksa içerik sessizce silinir.
 *
 * Görsel artık `![alt](id)` ile temsil edilebiliyor, ama ALT YAZISI olan görsel
 * hâlâ temsil edilemiyor; onu da engelliyoruz.
 */
export function hasUneditableBlocks(content: QuestionContent): boolean {
  return content.blocks.some(
    (b) => b.type === "table" || (b.type === "image" && Boolean(b.caption))
  );
}
