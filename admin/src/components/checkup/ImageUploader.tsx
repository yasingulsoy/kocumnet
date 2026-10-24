"use client";

import { useEffect, useImperativeHandle, useRef, useState, useTransition, type Ref } from "react";
import { ClipboardPaste, ImagePlus, X } from "lucide-react";
import { uploadMediaAction } from "@/lib/checkup/actions/media";
import { Dropzone } from "@/components/tailadmin/extras/dropzone/Dropzone";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { CODE } from "./ui";

/** Ham dosya sınırı: lib/checkup/media-image.ts GORSEL_DOSYA_SINIRI ile aynı (o modül sunucuya özel). */
const GORSEL_SINIRI = 8 * 1024 * 1024;

/** Sunucunun kabul ettikleri (actions/media.ts); SVG yok. */
const KABUL = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

/** Formun yükleyiciye dışarıdan dosya vermesi (soru metnine yapıştırılan ekran görüntüsü). */
export interface GorselYukleyiciTutamagi {
  dosyaVer: (dosya: File) => void;
}

/** Panodaki ilk görsel dosyası (ekran görüntüsü panoya PNG olarak düşer). */
export function panodakiGorsel(veri: DataTransfer | null): File | null {
  if (!veri) return null;
  return [...veri.files].find((f) => f.type.startsWith("image/")) ?? null;
}

/**
 * Geometri şekli / grafik yükleme — kitin Dropzone'u (sürükle-bırak ya da
 * "Görsel seç") ya da Ctrl+V ile ekran görüntüsü yapıştırma (yükleyicinin
 * içinde ya da soru metni kutusunda; form `dosyaVer` ile verir). Seçim
 * yalnızca bu bileşende: soru formunun içinde durduğu için dosya alanına ad
 * verilmiyor, soru kaydedilirken görsel GİTMEZ.
 *
 * Yükleme bitince metne `![alt](mediaId)` yazım biçimini ekliyoruz — yazar
 * kimlikle uğraşmıyor; nereye ekleneceğine form karar verir (imlecin yeri).
 * Alt metni burada, yükleme anında isteniyor: sonradan doldurulması
 * beklenirse hiç doldurulmuyor ve şekil ekran okuyucuya görünmez kalıyor.
 * Yapıştırınca imleç alt metni kutusuna gider: yaz, Enter'a bas.
 */
export function ImageUploader({
  onInsert,
  ref,
}: {
  onInsert: (markup: string) => void;
  ref?: Ref<GorselYukleyiciTutamagi>;
}) {
  const [dosya, setDosya] = useState<File | null>(null);
  /** Yapıştırılan dosyanın önizlemesi (Dropzone yalnızca kendi seçimini gösterir). */
  const [yapistirilan, setYapistirilan] = useState<{ dosya: File; adres: string } | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** Yükleme bitince ya da yapıştırınca Dropzone'u boşaltmak için yeniden kurulur. */
  const [tur, setTur] = useState(0);
  const altAlani = useRef<HTMLInputElement>(null);

  // Önizleme adresi bırakılır (yenisi gelince ya da bileşen kapanınca).
  useEffect(() => {
    if (!yapistirilan) return;
    const adres = yapistirilan.adres;
    return () => URL.revokeObjectURL(adres);
  }, [yapistirilan]);

  const yapistir = (f: File) => {
    if (!Object.hasOwn(KABUL, f.type)) {
      setError("Bu görsel türü desteklenmiyor (PNG, JPEG, WebP ya da GIF).");
      return;
    }
    if (f.size > GORSEL_SINIRI) {
      setError(`Görsel ${(f.size / 1024 / 1024).toFixed(1)} MB; en fazla 8 MB olabilir.`);
      return;
    }
    setError(null);
    setDosya(f);
    setYapistirilan({ dosya: f, adres: URL.createObjectURL(f) });
    setTur((t) => t + 1);
    // Alt metni zorunlu: yazar sıradaki adımı görsün.
    requestAnimationFrame(() => altAlani.current?.focus());
  };

  useImperativeHandle(ref, () => ({ dosyaVer: yapistir }));

  const gonder = () => {
    if (!dosya) {
      setError("Görsel seç ya da ekran görüntüsünü yapıştır (Ctrl+V).");
      return;
    }
    if (!alt.trim()) {
      setError("Alt metni yazın — şekli göremeyen öğrenci için.");
      altAlani.current?.focus();
      return;
    }

    setError(null);
    const fd = new FormData();
    // Panodan gelen dosyanın adı çoğu zaman "image.png": sunucu türüne bakıyor.
    fd.set("file", dosya, dosya.name || "ekran-goruntusu.png");
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
      setYapistirilan(null);
      setTur((t) => t + 1);
    });
  };

  return (
    <div
      role="group"
      aria-label="Şekil ya da grafik ekle"
      // Kutunun boş yerine tıklayınca odak buraya gelsin: Ctrl+V yapıştırma buradan da çalışır.
      tabIndex={-1}
      className="rounded-xl border border-gray-200 p-4 outline-none focus-within:border-brand-300"
      onPaste={(e) => {
        const f = panodakiGorsel(e.clipboardData);
        if (!f) return; // metin yapıştırması (alt metni kutusu) olduğu gibi kalsın
        e.preventDefault();
        yapistir(f);
      }}
    >
      <p className="mb-3 flex items-center gap-2 text-theme-sm font-medium text-gray-700">
        <ImagePlus className="size-4 text-gray-500" aria-hidden /> Şekil / grafik ekle
      </p>

      <div className="space-y-4">
        {error ? (
          <Alert variant="error" compact>
            {error}
          </Alert>
        ) : null}

        {yapistirilan ? (
          <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-25 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={yapistirilan.adres} alt="" className="h-16 w-auto max-w-40 rounded-md border border-gray-200 bg-white object-contain" />
            <p className="min-w-0 flex-1 text-theme-xs text-gray-600">
              <span className="flex items-center gap-1.5 font-medium text-gray-800">
                <ClipboardPaste aria-hidden className="size-3.5" /> Yapıştırılan görsel
              </span>
              {(yapistirilan.dosya.size / 1024).toFixed(0)} KB · alt metnini yaz, sonra yükle.
            </p>
            <Button
              variant="ghost"
              size="xs"
              aria-label="Yapıştırılan görseli kaldır"
              disabled={pending}
              onClick={() => {
                setYapistirilan(null);
                setDosya(null);
              }}
            >
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <Dropzone
            key={tur}
            ariaLabel="Şekil görseli: sürükle bırak, seç ya da Ctrl+V ile yapıştır"
            accept={KABUL}
            maxSize={GORSEL_SINIRI}
            preview
            compact
            disabled={pending}
            title="Görseli buraya sürükle"
            description="PNG, JPEG, WebP veya GIF · en fazla 8 MB · ekran görüntüsünü Ctrl+V ile yapıştırabilirsin"
            browseLabel="Görsel seç"
            onFilesChange={(d) => {
              setDosya(d[0] ?? null);
              if (d[0]) setError(null);
            }}
          />
        )}

        <Field label="Alt metni" required hint="Şekli göremeyen öğrenci için kısa tarif; öğrenci ekranında da görünür.">
          <Input
            ref={altAlani}
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
            Şekil soru metninde imlecin olduğu satıra eklenir. Soru metnine <kbd className={CODE}>Ctrl</kbd> +{" "}
            <kbd className={CODE}>V</kbd> ile ekran görüntüsü yapıştırabilirsin. Görsel 1200 piksele küçültülüp
            WebP&apos;ye çevrilir; SVG kabul edilmiyor (script taşıyabilir).
          </p>
        </div>
      </div>
    </div>
  );
}
