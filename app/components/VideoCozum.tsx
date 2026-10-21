"use client";

import { useState } from "react";
import { CirclePlay } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";

/**
 * Video çözüm — tıklayınca yüklenir.
 *
 * Gizlilik: sayfa açılınca üçüncü tarafa (YouTube/Vimeo) HİÇBİR istek
 * gitmez; önce sade bir kart, öğrenci dokununca oynatıcı. Oynatıcı çerezsiz
 * adresten (youtube-nocookie, Vimeo dnt=1; adres lib/question-content.ts
 * parseVideoUrl'den) ve dokunuşla açıldığı için kendiliğinden başlar.
 *
 * Yalnızca CEVAPTAN SONRA kullanılır (sonuç incelemesi, alıştırma geri
 * bildirimi): video çözümü anlatıyor.
 */
export function VideoCozum({
  embedUrl,
  provider,
  baslik = "Video çözüm",
  className,
}: {
  embedUrl: string;
  provider: "youtube" | "vimeo";
  /** iframe'in erişilebilir adı. */
  baslik?: string;
  className?: string;
}) {
  const [acik, setAcik] = useState(false);
  const kaynak = provider === "youtube" ? "YouTube" : "Vimeo";

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className={cx(
          "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-start transition hover:border-brand-200 hover:bg-brand-25 print:hidden",
          className
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <CirclePlay className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-theme-sm font-semibold text-gray-800">Video çözümü aç</span>
          <span className="block text-theme-xs text-gray-500">
            {kaynak} oynatıcısı dokununca yüklenir.
          </span>
        </span>
      </button>
    );
  }

  // Dokunuşla açıldı: tek dokunuşta oynasın (iki kez dokundurmayalım).
  const adres = new URL(embedUrl);
  adres.searchParams.set("autoplay", "1");

  return (
    <div className={cx("overflow-hidden rounded-xl border border-gray-200 bg-gray-900 print:hidden", className)}>
      <div className="aspect-video">
        <iframe
          src={adres.toString()}
          title={baslik}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full border-0"
        />
      </div>
    </div>
  );
}
