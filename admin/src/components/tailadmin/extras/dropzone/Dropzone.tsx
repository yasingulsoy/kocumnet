"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/form-elements/DropZone.tsx
 * Bağımlılık: react-dropzone (MIT) — `npx npm@10.9.4 install react-dropzone`
 *
 * Aynı görünüm: kesikli çerçeve, yuvarlak ikon, başlık, açıklama, altı
 * çizili "Dosya seç". Farklar:
 *  · Forma bağlı: `name` verilirse seçilen dosyalar gizli <input type=file>'a
 *    yazılır (sürükle-bırakta da) ve form gönderiminde gider. Reddedilen
 *    dosya formda KALMAZ. Pencereden vazgeçince önceki seçim geri gelir
 *    (react-dropzone açarken alanı boşaltıyor).
 *  · Ret iletileri Türkçe (boyut MB olarak), role="alert".
 *  · İsteğe bağlı önizleme ızgarası (kaldır düğmeli); kapalıysa önizlemeyi
 *    çağıran çizer (onFilesChange).
 *  · `onAdd`: seçimi çağıran tutar (kendi listesini çizen çok dosyalı
 *    ekran). Her bırakma/seçimde yalnızca yeni kabul edilen dosyalar gelir;
 *    bileşen liste tutmaz, reddedilen olsa da kabul edilenler gelir.
 *    `name` ve `preview` ile birlikte kullanılmaz.
 *  · Kök öğe klavyeyle odaklanır (Enter/Boşluk pencereyi açar), adı ariaLabel.
 */
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { Trash2, Upload } from "lucide-react";
import { cx } from "../../cx";

const MB = 1024 * 1024;

export interface DropzoneProps {
  /** Form alanı adı; verilirse dosyalar formla gider. */
  name?: string;
  accept?: Accept;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFilesChange?: (dosyalar: File[]) => void;
  /** Seçim çağıranda: her seferinde yalnızca yeni kabul edilen dosyalar (bileşen liste tutmaz). */
  onAdd?: (dosyalar: File[]) => void;
  /** Ret iletisi (çağıran da göstermek isterse). */
  onReject?: (ileti: string) => void;
  title?: ReactNode;
  description?: ReactNode;
  browseLabel?: string;
  activeTitle?: ReactNode;
  rejectTitle?: ReactNode;
  /** Kök öğenin erişilebilir adı. */
  ariaLabel: string;
  /** Dışarıdan hata (sunucu) — çerçeve kırmızı, metin altta. */
  error?: ReactNode;
  /** true: seçilen görsellerin küçük önizlemesi ve kaldır düğmesi. */
  preview?: boolean;
  /** Sıkı görünüm (kenar çubuğu kartı gibi dar yerler). */
  compact?: boolean;
  className?: string;
}

interface Secim {
  dosya: File;
  adres?: string;
}

function boyut(bayt: number) {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < MB) return `${(bayt / 1024).toFixed(1)} KB`;
  return `${(bayt / MB).toFixed(1)} MB`;
}

function retIletisi(retler: FileRejection[], maxSize?: number): string {
  const ilk = retler[0];
  const kod = ilk?.errors[0]?.code;
  if (kod === "file-too-large") {
    return `Bu dosya ${(ilk.file.size / MB).toFixed(1)} MB; en fazla ${maxSize ? Math.round(maxSize / MB) : "?"} MB olabilir.`;
  }
  if (kod === "file-invalid-type") return "Bu dosya türü desteklenmiyor.";
  if (kod === "too-many-files") return "Tek dosya seçebilirsin.";
  return "Dosya eklenemedi.";
}

function alanaYaz(alan: HTMLInputElement | null, dosyalar: File[]) {
  if (!alan) return;
  try {
    const dt = new DataTransfer();
    for (const d of dosyalar) dt.items.add(d);
    alan.files = dt.files;
  } catch {
    // DataTransfer kurulamayan eski tarayıcı: yalnızca pencereden seçim formla gider.
    if (!dosyalar.length) alan.value = "";
  }
}

export function Dropzone({
  name,
  accept,
  maxSize,
  multiple = false,
  disabled = false,
  onFilesChange,
  onAdd,
  onReject,
  title = "Dosyayı buraya sürükle",
  description,
  browseLabel = "Dosya seç",
  activeTitle = "Bırak, eklensin",
  rejectTitle = "Bu dosya eklenemez",
  ariaLabel,
  error,
  preview = false,
  compact = false,
  className,
}: DropzoneProps) {
  const [secilenler, setSecilenler] = useState<Secim[]>([]);
  const [ret, setRet] = useState<string | null>(null);
  const son = useRef<Secim[]>([]);
  /** Açık önizleme adresleri; bileşen kapanınca hepsi bırakılır. */
  const adresler = useRef(new Set<string>());

  useEffect(() => {
    const acik = adresler.current;
    return () => {
      for (const a of acik) URL.revokeObjectURL(a);
      acik.clear();
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject, isFocused, inputRef } = useDropzone({
    accept,
    maxSize,
    multiple,
    disabled,
    onDrop: (kabul, retler) => {
      if (retler.length) {
        const ileti = retIletisi(retler, maxSize);
        setRet(ileti);
        onReject?.(ileti);
      } else {
        setRet(null);
      }
      // Seçim çağıranda: liste tutulmaz, kabul edilenler olduğu gibi gider.
      if (onAdd) {
        if (kabul.length) onAdd(kabul);
        return;
      }
      if (retler.length) {
        ayarla([]);
        return;
      }
      ayarla(multiple ? [...son.current.map((s) => s.dosya), ...kabul] : kabul.slice(0, 1));
    },
    // react-dropzone pencereyi açarken alanı boşaltıyor; vazgeçilirse eski seçim geri.
    onFileDialogCancel: () =>
      alanaYaz(
        inputRef.current,
        son.current.map((s) => s.dosya)
      ),
  });

  function ayarla(dosyalar: File[]) {
    const eski = son.current;
    const yeni = dosyalar.map(
      (d) =>
        eski.find((e) => e.dosya === d) ?? {
          dosya: d,
          adres: preview && d.type.startsWith("image/") ? URL.createObjectURL(d) : undefined,
        }
    );
    for (const e of eski) {
      if (e.adres && !yeni.includes(e)) {
        URL.revokeObjectURL(e.adres);
        adresler.current.delete(e.adres);
      }
    }
    for (const y of yeni) if (y.adres) adresler.current.add(y.adres);
    son.current = yeni;
    setSecilenler(yeni);
    alanaYaz(inputRef.current, dosyalar);
    onFilesChange?.(dosyalar);
  }

  const cerceve = isDragReject
    ? "border-error-500 bg-error-50/60"
    : isDragAccept
      ? "border-brand-500 bg-brand-50/60"
      : error || ret
        ? "border-error-500 bg-gray-50"
        : isFocused
          ? "border-brand-500 bg-gray-50 ring-2 ring-brand-500/20"
          : "border-gray-300 bg-gray-50 hover:border-brand-500";

  const baslik = isDragReject ? rejectTitle : isDragActive ? activeTitle : title;
  const hata = error ?? ret;

  return (
    <div className={className}>
      <div
        {...getRootProps({ role: "button", "aria-label": ariaLabel, "aria-disabled": disabled || undefined })}
        className={cx(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition-all duration-200",
          compact ? "p-5" : "p-7 lg:p-10",
          disabled && "cursor-not-allowed opacity-60",
          cerceve
        )}
      >
        <input {...getInputProps({ name })} />
        <span className={cx("flex items-center justify-center rounded-full bg-gray-200 text-gray-700", compact ? "mb-3 size-11" : "mb-4 size-15")}>
          <Upload className={compact ? "size-5" : "size-6"} aria-hidden />
        </span>
        <span className={cx("mb-1.5 block font-semibold text-gray-800", compact ? "text-sm" : "text-theme-xl")}>{baslik}</span>
        {description ? <span className={cx("mb-3 block max-w-72.5 text-gray-600", compact ? "text-theme-xs" : "text-sm")}>{description}</span> : null}
        <span className="text-theme-sm font-medium text-brand-500 underline hover:text-brand-600">{browseLabel}</span>
      </div>

      {hata ? (
        <p role="alert" className="mt-2 text-theme-sm text-error-600">
          {hata}
        </p>
      ) : null}

      {preview && secilenler.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {secilenler.map(({ dosya: d, adres }) => (
            <li key={`${d.name}-${d.lastModified}`} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs">
              <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-100">
                {adres ? (
                  <Image src={adres} alt={d.name} fill unoptimized className="object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-gray-400">
                    <Upload className="size-8" aria-hidden />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => ayarla(son.current.filter((s) => s.dosya !== d).map((s) => s.dosya))}
                  aria-label={`${d.name} dosyasını kaldır`}
                  className="absolute end-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-error-600 shadow-theme-xs transition hover:bg-white"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="p-3">
                <p className="truncate text-theme-xs font-medium text-gray-800" title={d.name}>
                  {d.name}
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-gray-500">{boyut(d.size)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
