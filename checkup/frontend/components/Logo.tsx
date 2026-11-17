import { BRAND_COLORS, MONOGRAM, WORDMARK } from "@/lib/brand-paths";
import { cx } from "@/components/tailadmin/cx";

/*
 * Koçum.Net marka işaretleri ("Fosfor"). Yol verisi lib/brand-paths.ts'ten
 * (design/sync.mjs kopyası). Logo yazısı çizgiye çevrilmiş: sayfadaki yazı
 * tipinden bağımsız. SVG dolgusunda ham renk serbest (tokens.css notu).
 */

/** Kare ikon: fosforlu sarı zemin, lacivert "k". */
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

/** Yazı logosu "koçum.net". tone="light": koyu zeminde beyaz "koçum.". */
export function Wordmark({
  className,
  tone = "dark",
  size = "md",
}: {
  className?: string;
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
}) {
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

/** Logo + "Check-up" etiketi: uygulamanın adı. */
export function UygulamaLogosu({ size = "sm", tone = "dark" }: { size?: "sm" | "md"; tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Wordmark size={size} tone={tone} />
      <span
        className={cx(
          "rounded-md px-1.5 py-0.5 font-display text-micro font-semibold tracking-wide uppercase",
          tone === "light" ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700"
        )}
      >
        Check-up
      </span>
    </span>
  );
}
