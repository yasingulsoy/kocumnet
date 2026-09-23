"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { markupToContent } from "@/lib/checkup/shared/question-markup";
import type { InlineNode } from "@/lib/checkup/shared/question-content";

/**
 * Yazım biçiminin canlı önizlemesi.
 *
 * Öğrenci tarafında formüller sunucuda çiziliyor ve KaTeX'in JS'i tarayıcıya
 * hiç inmiyor. Burada inmesi kabul edilebilir: soru yazarken her tuşta
 * sunucuya gidip gelmek yazımı kullanılmaz hale getirir; rota da düşük
 * trafikli ve yetkili.
 *
 * Ayrıştırıcı öğrenci uygulamasıyla AYNI modül (shared/, oradan kopya):
 * burada doğru görünen soru öğrencide de aynı görünür.
 */

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: "#d92d20",
      strict: "ignore",
      output: "html",
    });
  } catch {
    return '<span style="color:#d92d20">[formül hatası]</span>';
  }
}

/** Görseller check-up veritabanında; panel kendi yetkili rotasından sunuyor. */
export const mediaUrl = (id: string) => "/api/checkup-media/" + encodeURIComponent(id);

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "math") {
          return (
            <span key={i} dangerouslySetInnerHTML={{ __html: renderLatex(node.latex, false) }} />
          );
        }
        if (node.type === "inline_image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={mediaUrl(node.mediaId)}
              alt={node.alt}
              className="inline-block h-[1.4em] w-auto align-text-bottom"
            />
          );
        }
        return <span key={i}>{node.text}</span>;
      })}
    </>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function ContentPreview({
  markup,
  compact = false,
  placeholder = "Önizleme burada görünecek.",
}: {
  markup: string;
  /** Şık önizlemesi: formüller satır içi, dikey boşluk yok. */
  compact?: boolean;
  placeholder?: string;
}) {
  const content = useMemo(() => markupToContent(markup), [markup]);

  if (!content.blocks.length) {
    return <p className="text-sm italic text-gray-400 dark:text-gray-500">{placeholder}</p>;
  }

  return (
    <div
      className={
        "text-gray-800 dark:text-white/90 " + (compact ? "text-[15px]" : "space-y-1 text-base")
      }
    >
      {content.blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className={compact ? "leading-normal" : "leading-[1.75]"}>
                <Inline nodes={block.content} />
              </p>
            );

          case "math_block":
            return compact ? (
              <span
                key={i}
                className="inline-block"
                dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, false) }}
              />
            ) : (
              <div
                key={i}
                className="my-3 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }}
              />
            );

          case "list":
            return (
              <ul key={i} className="my-3 space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="min-w-[1.75rem] shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {block.style === "roman"
                        ? (ROMAN[j] ?? j + 1) + "."
                        : block.style === "ordered"
                          ? j + 1 + "."
                          : "•"}
                    </span>
                    <span className="leading-[1.7]">
                      <Inline nodes={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "image":
            return (
              <figure key={i} className="my-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(block.mediaId)}
                  alt={block.alt}
                  className="mx-auto max-h-64 max-w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
                />
                <figcaption className="mt-1 text-center text-theme-xs text-gray-500 dark:text-gray-400">
                  {block.alt}
                </figcaption>
              </figure>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
