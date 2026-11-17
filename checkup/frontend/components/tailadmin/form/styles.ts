/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/input/InputField.tsx,
 * TextArea.tsx ve Select.tsx'teki sınıflar, tek yerde.
 *
 * "use client" YOK: sunucu bileşenleri de bu dizgeleri kullanabilsin.
 *
 * Durumlar sınıfla değil özniteliklerle: aria-invalid="true" → kırmızı,
 * data-state="success" → yeşil, disabled/readonly → gri. Field hata
 * verince alanı kendisi aria-invalid yapar.
 *
 * Genişlik: varsayılan w-full; başka genişlik için fullWidth={false} +
 * className="w-56" (kitte tailwind-merge yok, iki genişlik çakışır).
 *
 * focus:outline-hidden! — tokens.css'teki genel :focus-visible çerçevesi
 * katmansız olduğu için yardımcı sınıfı eziyordu; metin alanında odak
 * göstergesi marka rengi kenar + halka (TailAdmin'in görünümü).
 */
import { cx } from "../cx";

const ORTAK = cx(
  "rounded-lg border border-gray-300 bg-white text-gray-800 shadow-theme-xs transition",
  "placeholder:text-gray-500",
  "focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden!",
  "aria-invalid:border-error-500 aria-invalid:focus:border-error-500 aria-invalid:focus:ring-error-500/20",
  "data-[state=success]:border-success-500 data-[state=success]:focus:border-success-500 data-[state=success]:focus:ring-success-500/20",
  "disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none"
);

export interface FieldStyleOptions {
  /** 36px yükseklik: süzgeç ve araç çubukları. */
  compact?: boolean;
  /** 48px yükseklik, büyük yazı: yazı başlığı gibi öne çıkan alan. */
  large?: boolean;
  /** false: w-full yok, genişliği className verir. */
  fullWidth?: boolean;
}

/** Tek satırlık alan (input). */
export function inputClass({ compact = false, large = false, fullWidth = true }: FieldStyleOptions = {}) {
  return cx(
    ORTAK,
    "appearance-none read-only:bg-gray-50 read-only:text-gray-600",
    fullWidth && "w-full",
    compact ? "h-9 px-3 text-theme-sm" : large ? "h-12 px-4 py-2.5 text-lg" : "h-11 px-4 py-2.5 text-sm"
  );
}

export function textareaClass({ fullWidth = true }: Pick<FieldStyleOptions, "fullWidth"> = {}) {
  return cx(ORTAK, "block px-4 py-2.5 text-sm read-only:bg-gray-50 read-only:text-gray-600", fullWidth && "w-full");
}

/** Yerel select; ok simgesi Select bileşeninde. Yer tutucu (disabled seçenek) seçiliyken gri. */
export function selectClass({ compact = false }: Pick<FieldStyleOptions, "compact"> = {}) {
  return cx(
    ORTAK,
    "w-full cursor-pointer appearance-none has-[option:disabled:checked]:text-gray-500",
    compact ? "h-9 ps-3 pe-9 text-theme-sm" : "h-11 ps-4 pe-11 text-sm"
  );
}

/** Etiket; alt boşluk (mb-1.5) Label bileşeninde. */
export const labelClass = "block text-sm font-medium text-gray-700";
export const hintClass = "mt-1.5 text-theme-xs text-gray-500";
export const errorClass = "mt-1.5 text-theme-xs font-medium text-error-600";
