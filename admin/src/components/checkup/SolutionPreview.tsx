"use client";

import { useMemo } from "react";
import { ExternalLink, Lightbulb, PlayCircle } from "lucide-react";
import { contentToMarkup, markupToContent } from "@/lib/checkup/shared/question-markup";
import type { ContentBlock, QuestionContent } from "@/lib/checkup/shared/question-content";
import { ContentPreview, mediaUrl } from "./ContentPreview";

/**
 * Çözüm, ipucu ve video önizlemeleri — soru formu ve toplu içe aktarma ortak.
 *
 * ⚠️ shared/question-content.ts'ten burada YALNIZCA tip alınır: o modül
 * parmak izi için `node:crypto` içe aktarıyor, çalışma anı değeri istemci
 * paketine girerse derleme kırılır (ya da tarayıcıya crypto yaması iner).
 * Bu yüzden adımlara bölme aşağıda küçük bir ikiz olarak duruyor; kural
 * splitSolutionSteps ile aynı: ayırıcıda böl, boş adımı at. Ayrıştırıcının
 * kendisi (markupToContent) ortak modülden, öğrencinin gördüğüyle aynı.
 */

/** splitSolutionSteps'in istemci ikizi (bkz. dosya başı). */
function adimlaraBol(icerik: QuestionContent): QuestionContent[] {
  const adimlar: QuestionContent[] = [];
  let mevcut: ContentBlock[] = [];
  const kapat = () => {
    if (mevcut.some((b) => b.type !== "spacer")) adimlar.push({ version: 1, blocks: mevcut });
    mevcut = [];
  };
  for (const b of icerik.blocks) {
    if (b.type === "step_break") kapat();
    else mevcut.push(b);
  }
  kapat();
  return adimlar;
}

/** Yazımdaki adımlar (her biri yine yazım biçiminde). Boş çözüm: boş liste. */
export function cozumAdimlari(markup: string): string[] {
  return adimlaraBol(markupToContent(markup)).map(contentToMarkup);
}

/**
 * Çözüm önizlemesi: ayırıcı varsa adımlar numaralı ("Adım 1/3"), öğrencinin
 * açacağı sırayla; yoksa düz metin.
 */
export function CozumOnizleme({
  markup,
  placeholder = "Çözüm yazılmadı.",
  gorselAdresi = mediaUrl,
}: {
  markup: string;
  placeholder?: string;
  gorselAdresi?: (id: string) => string;
}) {
  const adimlar = useMemo(() => cozumAdimlari(markup), [markup]);
  if (adimlar.length === 0) return <p className="text-theme-sm text-gray-500 italic">{placeholder}</p>;
  if (adimlar.length === 1) return <ContentPreview markup={adimlar[0]} gorselAdresi={gorselAdresi} />;
  return (
    <ol className="space-y-2.5" aria-label={"Çözüm, " + adimlar.length + " adım"}>
      {adimlar.map((m, i) => (
        <li key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <p className="tabular mb-1 text-theme-xs font-semibold text-brand-700">
            Adım {i + 1}/{adimlar.length}
          </p>
          <ContentPreview markup={m} gorselAdresi={gorselAdresi} />
        </li>
      ))}
    </ol>
  );
}

/** İpuçları, açılış sırasıyla. */
export function IpucuOnizleme({ ipuclari, gorselAdresi = mediaUrl }: { ipuclari: string[]; gorselAdresi?: (id: string) => string }) {
  const dolu = ipuclari.filter((m) => m.trim());
  if (dolu.length === 0) return null;
  return (
    <ol className="space-y-2" aria-label="İpuçları">
      {dolu.map((m, i) => (
        <li key={i} className="flex gap-2.5 rounded-lg border border-warning-200 bg-warning-25 px-3 py-2">
          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-theme-xs font-semibold text-warning-700">
            <Lightbulb aria-hidden className="size-3.5" />
            <span className="tabular">{i + 1}.</span>
          </span>
          <div className="min-w-0 flex-1">
            <ContentPreview markup={m} gorselAdresi={gorselAdresi} compact />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Kayıtlı video bağlantısı (parseVideoUrl'in canonicalUrl'i). Önizlemede
 * gömülü oynatıcı yok, bağlantı yeter: panel üçüncü taraf çerez yüklemesin.
 */
export function VideoBaglantisi({ url }: { url: string }) {
  let saglayici = "Video";
  let baslangic = 0;
  try {
    const u = new URL(url);
    saglayici = u.hostname.includes("vimeo") ? "Vimeo" : u.hostname.includes("youtu") ? "YouTube" : "Video";
    baslangic = Number(u.searchParams.get("t") ?? 0) || 0;
  } catch {
    // canonicalUrl her zaman geçerli adres; bozuksa düz bağlantı yeter.
  }
  const dk = Math.floor(baslangic / 60);
  const sn = String(baslangic % 60).padStart(2, "0");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
    >
      <PlayCircle aria-hidden className="size-4 shrink-0" />
      <span className="truncate">
        {saglayici}&apos;da aç{baslangic > 0 ? " · başlangıç " + dk + ":" + sn : ""}
      </span>
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
    </a>
  );
}
