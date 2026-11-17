import { BRAND_COLORS, MONOGRAM, WORDMARK } from "@/lib/brand-paths";
import { cx } from "@/components/tailadmin/cx";

/*
 * Koçum.Net marka işaretleri ("Fosfor"). Yol verisi lib/brand-paths.ts'ten
 * (design/brand → `node design/sync.mjs`). SVG dolguları marka renkleri:
 * belirteç kuralının istisnası (tokens.css başındaki not).
 */

/** Kare ikon: fosforlu sarı zemin, lacivert "k". Dar kenar çubuğunda. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={MONOGRAM.viewBox}
      className={cx("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx={MONOGRAM.radius} fill={BRAND_COLORS.highlight} />
      <path d={MONOGRAM.k} fill={BRAND_COLORS.ink} />
    </svg>
  );
}

/** "koçum.net" yazı logosu. tone="light": koyu zeminde beyaz "koçum.". */
export function Wordmark({ className, tone = "dark", size = "md" }: { className?: string; tone?: "dark" | "light"; size?: "sm" | "md" | "lg" }) {
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      role="img"
      aria-label="Koçum.Net"
      className={cx("w-auto shrink-0", size === "lg" ? "h-10" : size === "sm" ? "h-6" : "h-8", className)}
    >
      <path d={WORDMARK.swipe} fill={BRAND_COLORS.highlight} />
      <path d={WORDMARK.koc} fill={tone === "light" ? "#ffffff" : BRAND_COLORS.ink} />
      <path d={WORDMARK.net} fill={BRAND_COLORS.ink} />
    </svg>
  );
}

/** Kenar çubuğundaki logo: yazı logosu + "Check-up paneli" alt yazısı. */
export function PanelLogosu() {
  return (
    <span className="flex flex-col items-start gap-1.5">
      <Wordmark size="sm" />
      <span className="ps-0.5 text-[0.625rem] leading-none font-semibold tracking-[0.16em] text-gray-500 uppercase">Check-up paneli</span>
    </span>
  );
}
