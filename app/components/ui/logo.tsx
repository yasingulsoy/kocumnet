import { BRAND_COLORS, MONOGRAM, WORDMARK } from "@/lib/brand-paths";
import { cn } from "@/lib/cn";

/*
 * Koçum.Net marka işaretleri — "Fosfor". Tanıtım sitesi ve yönetim
 * paneliyle AYNI çizim: yol verisi design/brand/'dan (lib/brand-paths.ts
 * otomatik kopya; `node design/sync.mjs`). Yazı tipine bağlı değil.
 *
 * Ürün adı ("Check-up") işarette değil, logonun yanında metin olarak durur.
 */

/** Kare ikon: fosforlu sarı zemin, lacivert "k". Sınav ekranının üst çubuğu ve favicon. */
export function Logo({ className }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox={MONOGRAM.viewBox} aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx={MONOGRAM.radius} fill={BRAND_COLORS.highlight} />
      <path d={MONOGRAM.k} fill={BRAND_COLORS.ink} />
    </svg>
  );
}

/** Yalnızca "koçum.net" yazısı. light: koyu zemin (beyaz "koçum."). */
export function LogoYazi({ className, light }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox={WORDMARK.viewBox} role="img" aria-label="Koçum.Net" className={cn("h-7 w-auto shrink-0", className)}>
      <path d={WORDMARK.swipe} fill={BRAND_COLORS.highlight} />
      <path d={WORDMARK.koc} fill={light ? "#ffffff" : BRAND_COLORS.ink} />
      <path d={WORDMARK.net} fill={BRAND_COLORS.ink} />
    </svg>
  );
}

/**
 * Logo + ürün adı.
 * compact: dar mobil çubuk — logo küçük, ürün adı yanında etiket olarak.
 */
export function Wordmark({
  className,
  tone = "dark",
  compact,
}: {
  className?: string;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const light = tone === "light";
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <LogoYazi light={light} className="h-[22px]" />
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            light ? "bg-white/10 text-white/80" : "bg-gray-100 text-gray-600"
          )}
        >
          check-up
        </span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col items-start gap-1.5", className)}>
      <LogoYazi light={light} />
      <span
        className={cn(
          "ps-0.5 text-[9.5px] font-semibold uppercase leading-none tracking-[0.16em]",
          light ? "text-white/70" : "text-gray-500"
        )}
      >
        Matematik Check-up
      </span>
    </span>
  );
}
