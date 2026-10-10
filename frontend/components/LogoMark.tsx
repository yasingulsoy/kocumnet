import { BRAND_COLORS, MONOGRAM, WORDMARK } from "@/lib/brand-paths";
import { cx } from "@/components/tailadmin/cx";

/*
 * Koçum.Net marka işaretleri — "Fosfor".
 *
 * Yol verisi design/brand/'dan gelir (lib/brand-paths.ts otomatik kopya;
 * `node design/sync.mjs`). Logo yazısı çizgiye çevrilmiş Baloo 2 ExtraBold:
 * sayfada hangi yazı tipi yüklü olursa olsun aynı görünür. Check-up
 * uygulaması ve yönetim paneli aynı veriyi kullanır.
 */

/** Kare ikon: fosforlu sarı zemin, lacivert "k". Favicon ve uygulama ikonuyla aynı. */
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

/**
 * Yazı logosu "koçum.net".
 *
 * tone="dark"  (varsayılan) açık zemin: lacivert yazı.
 * tone="light" koyu zemin: beyaz "koçum.", "net" her zaman sarı kalemin
 *              üstünde lacivert (beyaz yazı sarıda okunmuyor).
 */
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
