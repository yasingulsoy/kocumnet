import clsx from "clsx";
import { BRAND_COLORS, MONOGRAM, WORDMARK } from "@/lib/brand-paths";

/*
 * Koçum.Net marka işaretleri — "Fosfor". Tanıtım sitesi ve check-up
 * uygulamasıyla AYNI çizim: yol verisi design/brand/'dan (lib/brand-paths.ts
 * otomatik kopya; `node design/sync.mjs`).
 */

/** Kare ikon: fosforlu sarı zemin, lacivert "k". */
export function Logo({ className }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox={MONOGRAM.viewBox} aria-hidden="true" className={clsx("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx={MONOGRAM.radius} fill={BRAND_COLORS.highlight} />
      <path d={MONOGRAM.k} fill={BRAND_COLORS.ink} />
    </svg>
  );
}

/** Yalnızca "koçum.net" yazısı. light: koyu zemin (beyaz "koçum."). */
export function LogoYazi({ className, light }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox={WORDMARK.viewBox} role="img" aria-label="Koçum.Net" className={clsx("h-7 w-auto shrink-0", className)}>
      <path d={WORDMARK.swipe} fill={BRAND_COLORS.highlight} />
      <path d={WORDMARK.koc} fill={light ? "#ffffff" : BRAND_COLORS.ink} />
      <path d={WORDMARK.net} fill={BRAND_COLORS.ink} />
    </svg>
  );
}

/** Logo + "Check-up Paneli" etiketi. compact: yalnızca logo (dar çubuk). */
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
  if (compact) return <LogoYazi light={light} className={clsx("h-[22px]", className)} />;
  return (
    <span className={clsx("inline-flex flex-col items-start gap-1.5", className)}>
      <LogoYazi light={light} />
      <span
        className={clsx(
          "ps-0.5 text-[9.5px] font-semibold uppercase leading-none tracking-[0.16em]",
          light ? "text-white/70" : "text-ink-faint"
        )}
      >
        Check-up Paneli
      </span>
    </span>
  );
}
