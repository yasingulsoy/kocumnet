"use client";

import { useRef, useState, useTransition } from "react";
import { uploadMediaAction } from "@/lib/checkup/actions/media";
import { INPUT_CLASS, Notice, buttonClass } from "./ui";

/**
 * Geometri şekli / grafik yükleme.
 *
 * Yükleme bitince metne `![alt](mediaId)` yazım biçimini ekliyoruz — yazar
 * kimlikle uğraşmıyor. Alt metni burada, yükleme anında isteniyor: sonradan
 * doldurulması beklenirse hiç doldurulmuyor ve şekil ekran okuyucuya görünmez
 * kalıyor.
 */
export function ImageUploader({ onInsert }: { onInsert: (markup: string) => void }) {
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const gonder = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Dosya seçin.");
      return;
    }
    if (!alt.trim()) {
      setError("Alt metni yazın — şekli göremeyen öğrenci için.");
      return;
    }

    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("alt", alt.trim());

    start(async () => {
      const res = await uploadMediaAction(fd);
      if (!res.ok || !res.mediaId) {
        setError(res.error ?? "Yükleme başarısız.");
        return;
      }
      onInsert("![" + res.alt + "](" + res.mediaId + ")");
      setAlt("");
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Şekil / grafik ekle</p>

      {error ? <Notice className="mt-3">{error}</Notice> : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Görsel dosyası"
          className="min-w-0 flex-1 basis-56 text-theme-sm text-gray-600 file:me-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-theme-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-400 dark:file:bg-white/5 dark:file:text-gray-300"
        />
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          aria-label="Alt metni"
          placeholder="Alt metni: ör. Dik üçgen ABC"
          maxLength={300}
          className={INPUT_CLASS + " min-w-0 flex-1 basis-56"}
        />
        <button
          type="button"
          onClick={gonder}
          disabled={pending}
          className={buttonClass("outline", "md")}
        >
          {pending ? "Yükleniyor…" : "Yükle ve ekle"}
        </button>
      </div>

      <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
        PNG, JPEG, WebP veya GIF · en fazla 8 MB. Görsel 1200 piksele küçültülüp WebP&apos;ye
        çevrilir. SVG kabul edilmiyor (script taşıyabilir).
      </p>
    </div>
  );
}
