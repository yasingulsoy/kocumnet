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
    <div className="rounded-xl border border-dashed border-line-strong p-4">
      <p className="text-caption font-medium text-ink-soft">Şekil / grafik ekle</p>

      {error ? <Notice className="mt-3">{error}</Notice> : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Görsel dosyası"
          className="min-w-0 flex-1 basis-56 text-caption text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-surface-sunk file:px-3 file:py-2 file:text-caption file:font-medium file:text-ink-soft hover:file:bg-line"
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

      <p className="mt-2 text-micro text-ink-faint">
        PNG, JPEG, WebP veya GIF · en fazla 8 MB. Görsel 1200 piksele küçültülüp WebP&apos;ye
        çevrilir. SVG kabul edilmiyor (script taşıyabilir).
      </p>
    </div>
  );
}
