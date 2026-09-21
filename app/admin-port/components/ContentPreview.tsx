"use client";

import katex from "katex";
import { useMemo } from "react";
import { markupToContent } from "@/lib/question-markup";
import type { InlineNode } from "@/lib/question-content";

/**
 * Yazım biçiminin canlı önizlemesi — SADECE admin tarafı.
 *
 * Öğrenci tarafında formüller sunucuda render ediliyor (components/MathContent.tsx)
 * ve KaTeX'in JS'i tarayıcıya hiç inmiyor. Burada inmesi kabul edilebilir:
 * soru yazarken her tuşta sunucuya gidip gelmek yazımı kullanılmaz hale getirir,
 * ve bu rota düşük trafikli ve yetkili.
 *
 * Bu yüzden MathContent ile küçük bir tekrar var; ikisinin kısıtları farklı.
 */

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: "#c0392b",
      strict: "ignore",
      output: "html",
    });
  } catch {
    return '<span style="color:#c0392b">[formül hatası]</span>';
  }
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "math") {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: renderLatex(node.latex, false) }}
            />
          );
        }
        if (node.type === "inline_image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={"/api/media/" + node.mediaId}
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
    return <p className="text-sm italic text-ink-faint">{placeholder}</p>;
  }

  return (
    <div className={compact ? "text-[15px]" : "space-y-1 text-[16px]"}>
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
                className="my-3 text-center"
                dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }}
              />
            );

          case "list":
            return (
              <ul key={i} className="my-3 space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="min-w-[1.75rem] shrink-0 font-mono text-sm font-medium text-ink-soft">
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
                  src={"/api/media/" + block.mediaId}
                  alt={block.alt}
                  className="mx-auto max-h-64 max-w-full rounded border border-line bg-white"
                />
                <figcaption className="mt-1 text-center text-[11px] text-ink-faint">
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
