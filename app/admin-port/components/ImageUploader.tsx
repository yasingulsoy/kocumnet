"use client";

import { useRef, useState, useTransition } from "react";
import { uploadMediaAction } from "@/lib/actions/media";
import { Alert, Button, INPUT_CLASS } from "@/components/ui";

/**
 * Geometri şekli / grafik yükleme.
 *
 * Yükleme bitince metne `![alt](mediaId)` yazım biçimini ekliyoruz — admin
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
    <div className="rounded-lg border border-line bg-surface-sunk p-3">
      <p className="text-xs font-semibold text-ink">Şekil / grafik ekle</p>

      {error ? (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="flex-1 basis-48 text-xs text-ink-soft file:me-2 file:rounded file:border-0 file:bg-surface file:px-2 file:py-1 file:text-xs file:font-medium"
        />
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Alt metni: ör. Dik üçgen ABC"
          className={INPUT_CLASS + " flex-1 basis-56 !py-1.5 text-xs"}
        />
        <Button type="button" variant="ghost" onClick={gonder} disabled={pending} className="!py-1.5">
          {pending ? "Yükleniyor…" : "Yükle ve ekle"}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-ink-faint">
        PNG, JPEG, WebP veya GIF · en fazla 8 MB. Yüklenen görsel 1200 piksele küçültülüp
        WebP&apos;ye çevrilir. SVG kabul edilmiyor (script taşıyabilir).
      </p>
    </div>
  );
}
