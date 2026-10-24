import { cache } from "react";
import katex from "katex";
import { ZoomIn } from "lucide-react";
import { prisma } from "@/lib/db";
import type { ContentBlock, InlineNode, QuestionContent } from "@/lib/question-content";
import { latexCizimi } from "@/lib/question-markup";

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
    // Saklanan kaynak değişmez; ondalık virgül yalnızca çizimde bitişir (question-markup.ts latexCizimi).
    return katex.renderToString(latexCizimi(latex), {
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

/*
 * Şeklin piksel boyutu MediaAsset'te (yüklemede sharp yazıyor, lib/media-image.ts).
 * Soru gövdesi yalnızca mediaId taşıyor; boyut burada, istek başına görsel
 * başına bir kez okunur (React cache) ve <img>'e width/height olarak yazılır.
 * Eskiden yazılmıyordu: tarayıcı şekil inene kadar yer ayırmıyor, şekil
 * gelince altındaki şıklar aşağı kayıyordu (öğrenci yanlış şıkka dokunuyordu).
 * Boyutu olmayan eski kayıtta öznitelik yok, eskisi gibi. Cevap anahtarıyla
 * ilgisi yok: yalnızca genişlik ve yükseklik okunur.
 */
const gorselBoyutu = cache(async (mediaId: string): Promise<{ width: number; height: number } | null> => {
  try {
    const m = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { width: true, height: true } });
    return m?.width && m.height ? { width: m.width, height: m.height } : null;
  } catch {
    // Boyut okunamadıysa şekil yine çizilir; yalnızca yer önceden ayrılmaz.
    return null;
  }
});

/**
 * Soru görseli. `h-auto` (blok şekil) ya da sabit yükseklik (satır içi simge)
 * sınıfla verilir; width/height öznitelikleri tarayıcıya en-boy oranını söyler.
 */
async function Gorsel({ mediaId, alt, className }: { mediaId: string; alt: string; className: string }) {
  const boyut = await gorselBoyutu(mediaId);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(mediaId)} alt={alt} width={boyut?.width} height={boyut?.height} className={className} />
  );
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
            <Gorsel
              key={i}
              mediaId={node.mediaId}
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
 *
 * `buyutulebilir`: şekil bir düğmenin içinde, dokununca tam ekranda açılır
 * (components/GorselBuyutec.tsx tıklamayı `data-gorsel-buyut` ile yakalar).
 * Yalnızca o pencereyi kuran ekranlarda ver: başka yerde ölü düğme olur.
 */
function Block({ block, compact, buyutulebilir }: { block: ContentBlock; compact: boolean; buyutulebilir: boolean }) {
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

    case "image": {
      const gorsel = (
        <Gorsel
          mediaId={block.mediaId}
          alt={block.alt}
          // h-auto: daralan ekranda yükseklik width/height oranıyla küçülsün (öznitelikteki piksel kalmasın).
          className="mx-auto h-auto max-w-full rounded-lg border border-gray-200 bg-white"
        />
      );
      return (
        <figure className="my-4">
          {buyutulebilir ? (
            // İpucu şeklin altında, üstünde değil: köşedeki bir rozet şeklin
            // köşe harfini (A, B…) örtüyordu.
            <button
              type="button"
              data-gorsel-buyut
              aria-label={`Şekli büyüt: ${block.alt}`}
              className="group/gorsel mx-auto block w-fit max-w-full cursor-zoom-in touch-manipulation rounded-lg"
            >
              {gorsel}
              <span
                aria-hidden
                className="mt-1.5 flex items-center justify-end gap-1 text-theme-xs font-medium text-gray-500 transition group-hover/gorsel:text-brand-500"
              >
                <ZoomIn className="size-3.5" />
                Büyüt
              </span>
            </button>
          ) : (
            gorsel
          )}
          {block.caption ? (
            <figcaption className="mt-2 text-center text-xs text-gray-500">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }

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
                      className="border border-gray-200 bg-gray-50 px-3 py-2 text-start font-semibold"
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
                    <td key={c} className="border border-gray-200 px-3 py-2">
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
              <span className="min-w-[1.75rem] shrink-0 font-mono text-sm font-medium text-gray-600">
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

    // Çözümü adım adım açan bileşen adımları önceden böler; buraya gelen
    // ayırıcı (yazdırma, tek parça gösterim) ince bir çizgi olur.
    case "step_break":
      return <hr className="my-3 border-dashed border-gray-200" aria-hidden />;
  }
}

export function MathContent({
  content,
  className = "",
  compact = false,
  buyutulebilir = false,
}: {
  content: QuestionContent;
  className?: string;
  /** Şık içeriği için: formüller satır içi, dikey boşluk yok. */
  compact?: boolean;
  /** Şekiller dokununca tam ekranda açılsın (sınav ve alıştırma ekranı). */
  buyutulebilir?: boolean;
}) {
  return (
    <div className={className}>
      {content.blocks.map((block, i) => (
        <Block key={i} block={block} compact={compact} buyutulebilir={buyutulebilir && !compact} />
      ))}
    </div>
  );
}
