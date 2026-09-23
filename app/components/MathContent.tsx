import katex from "katex";
import type { ContentBlock, InlineNode, QuestionContent } from "@/lib/question-content";

/**
 * Soru gövdesini ekrana basar.
 *
 * LaTeX SUNUCUDA HTML'e çevrilir: KaTeX'in ~280 KB'lık JS paketi istemciye
 * hiç gitmez, yalnızca stil dosyası yüklenir. Sonuç: formüller ilk boyamada
 * hazır, JavaScript beklemeden.
 *
 * Güvenlik: `trust: false` (varsayılan) ile \href, \url ve \includegraphics
 * gibi komutlar devre dışı; KaTeX çıktısı kaçışlanmış HTML üretir. LaTeX
 * kaynağı zaten yalnızca admin panelinden girilir.
 */

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      // Hatalı formül kırmızı görünsün; sessizce boş bırakmak, sorunun
      // eksik gösterildiğini kimseye söylemez.
      errorColor: "#c0392b",
      strict: "ignore",
      /*
       * "html" DEĞİL: KaTeX o modda MathML çıktısını hiç üretmiyor ve geriye
       * kalan .katex-html düğümü aria-hidden olduğu için ekran okuyucu
       * formülleri TAMAMEN atlıyordu — her sayı, kesir ve kök sessizdi.
       * htmlAndMathml ikisini birden verir: görenler HTML'i, ekran okuyucu
       * MathML'i okur. Maliyeti yalnızca HTML boyutu (JS'e etkisi yok).
       */
      output: "htmlAndMathml",
    });
  } catch {
    return `<span style="color:#c0392b">[formül hatası]</span>`;
  }
}

function mediaUrl(mediaId: string) {
  return `/api/media/${mediaId}`;
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "math") {
          return (
            <span
              key={i}
              // KaTeX çıktısı; kaynak admin girişi ve trust:false ile üretildi.
              dangerouslySetInnerHTML={{ __html: renderLatex(node.latex, false) }}
            />
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

        let el: React.ReactNode = node.text;
        if (node.bold) el = <strong className="font-semibold">{el}</strong>;
        if (node.italic) el = <em>{el}</em>;
        if (node.sub) el = <sub>{el}</sub>;
        if (node.sup) el = <sup>{el}</sup>;
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * `compact`: şık içeriği. Şıkta formül ortalanmaz ve dikey boşluk almaz —
 * "16" gibi tek sayılık bir cevabın satırın ortasına kaçması ve şıkları
 * gereksizce uzatması okumayı zorlaştırıyor.
 */
function Block({ block, compact }: { block: ContentBlock; compact: boolean }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className={compact ? "leading-normal" : "leading-[1.75]"}>
          <Inline nodes={block.content} />
        </p>
      );

    case "math_block":
      return compact ? (
        <span
          className="inline-block"
          dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, false) }}
        />
      ) : (
        <div
          className="my-3 text-center"
          dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }}
        />
      );

    case "image":
      return (
        <figure className="my-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(block.mediaId)}
            alt={block.alt}
            className="mx-auto max-w-full rounded-lg border border-line bg-white"
          />
          {block.caption ? (
            <figcaption className="mt-2 text-center text-xs text-ink-faint">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );

    case "table":
      return (
        <div className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {block.header ? (
              <thead>
                <tr>
                  {block.header.map((cell, i) => (
                    <th
                      key={i}
                      className="border border-line bg-surface-sunk px-3 py-2 text-start font-semibold"
                    >
                      <Inline nodes={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-line px-3 py-2">
                      <Inline nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list":
      // I, II, III öncülleri — ÖSYM formatının vazgeçilmezi. Numaralandırmayı
      // CSS'e bırakmıyoruz: roma rakamları büyük harf olmalı ve hizalanmalı.
      return (
        <ul className="my-3 space-y-1.5 ps-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="min-w-[1.75rem] shrink-0 font-mono text-sm font-medium text-ink-soft">
                {block.style === "roman"
                  ? `${ROMAN[i] ?? i + 1}.`
                  : block.style === "ordered"
                    ? `${i + 1}.`
                    : "•"}
              </span>
              <span className="leading-[1.7]">
                <Inline nodes={item} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "spacer":
      return <div className="h-3" aria-hidden />;
  }
}

export function MathContent({
  content,
  className = "",
  compact = false,
}: {
  content: QuestionContent;
  className?: string;
  /** Şık içeriği için: formüller satır içi, dikey boşluk yok. */
  compact?: boolean;
}) {
  return (
    <div className={className}>
      {content.blocks.map((block, i) => (
        <Block key={i} block={block} compact={compact} />
      ))}
    </div>
  );
}
