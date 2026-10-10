"use client";

import { useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { uploadMediaAction } from "@/lib/checkup/actions/media";
import { Dropzone } from "@/components/tailadmin/extras/dropzone/Dropzone";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

/** Ham dosya sınırı: lib/checkup/media-image.ts GORSEL_DOSYA_SINIRI ile aynı (o modül sunucuya özel). */
const GORSEL_SINIRI = 8 * 1024 * 1024;

/** Sunucunun kabul ettikleri (actions/media.ts); SVG yok. */
const KABUL = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

/**
 * Geometri şekli / grafik yükleme — kitin Dropzone'u (sürükle-bırak ya da
 * "Görsel seç"). Seçim yalnızca bu bileşende: soru formunun içinde durduğu
 * için dosya alanına ad verilmiyor, soru kaydedilirken görsel GİTMEZ.
 *
 * Yükleme bitince metne `![alt](mediaId)` yazım biçimini ekliyoruz — yazar
 * kimlikle uğraşmıyor. Alt metni burada, yükleme anında isteniyor: sonradan
 * doldurulması beklenirse hiç doldurulmuyor ve şekil ekran okuyucuya görünmez
 * kalıyor.
 */
export function ImageUploader({ onInsert }: { onInsert: (markup: string) => void }) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** Yükleme bitince Dropzone'u boşaltmak için yeniden kurulur. */
  const [tur, setTur] = useState(0);

  const gonder = () => {
    if (!dosya) {
      setError("Dosya seçin.");
      return;
    }
    if (!alt.trim()) {
      setError("Alt metni yazın — şekli göremeyen öğrenci için.");
      return;
    }

    setError(null);
    const fd = new FormData();
    fd.set("file", dosya);
    fd.set("alt", alt.trim());

    start(async () => {
      const res = await uploadMediaAction(fd);
      if (!res.ok || !res.mediaId) {
        setError(res.error ?? "Yükleme başarısız.");
        return;
      }
      onInsert("![" + res.alt + "](" + res.mediaId + ")");
      setAlt("");
      setDosya(null);
      setTur((t) => t + 1);
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="mb-3 flex items-center gap-2 text-theme-sm font-medium text-gray-700">
        <ImagePlus className="size-4 text-gray-500" aria-hidden /> Şekil / grafik ekle
      </p>

      <div className="space-y-4">
        {error ? (
          <Alert variant="error" compact>
            {error}
          </Alert>
        ) : null}

        <Dropzone
          key={tur}
          ariaLabel="Şekil görseli: sürükle bırak ya da seç"
          accept={KABUL}
          maxSize={GORSEL_SINIRI}
          preview
          compact
          disabled={pending}
          title="Görseli buraya sürükle"
          description="PNG, JPEG, WebP veya GIF · en fazla 8 MB"
          browseLabel="Görsel seç"
          onFilesChange={(d) => {
            setDosya(d[0] ?? null);
            if (d[0]) setError(null);
          }}
        />

        <Field label="Alt metni" required hint="Şekli göremeyen öğrenci için kısa tarif; öğrenci ekranında da görünür.">
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              // Enter soru formunu göndermesin; yüklesin.
              if (e.key === "Enter") {
                e.preventDefault();
                gonder();
              }
            }}
            placeholder="ör. Dik üçgen ABC"
            maxLength={300}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="xs" loading={pending} onClick={gonder}>
            {pending ? "Yükleniyor…" : "Yükle ve ekle"}
          </Button>
          <p className="min-w-0 flex-1 basis-56 text-theme-xs text-gray-500">
            Görsel 1200 piksele küçültülüp WebP&apos;ye çevrilir. SVG kabul edilmiyor (script taşıyabilir).
          </p>
        </div>
      </div>
    </div>
  );
}
