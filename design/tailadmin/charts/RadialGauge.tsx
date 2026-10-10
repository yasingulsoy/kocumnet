/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/MonthlyTarget.tsx'teki
 * yarım daire radialBar'ın görünümü, ApexCharts'sız.
 *
 * Yarım daire gösterge: gri ray (#e4e7ec), marka mavisi yay, yuvarlak uç,
 * ortada büyük yüzde. SVG yolu pathLength=100 ile: yay = yüzde. Arapça
 * sayfada yay sağdan başlar (SVG aynalanır, yazı aynalanmaz). `size="sm"`:
 * dar yerde (kart içi küçük gösterge) küçük yazı.
 */
import type { ReactNode } from "react";
import { cx } from "../cx";

export interface RadialGaugeProps {
  /** 0–100 arası; dışı kırpılır. */
  value: number;
  /** Ortadaki yazı; varsayılan "%75". */
  label?: ReactNode;
  /** Ekran okuyucu için: "Yanıtlanan mesaj oranı". */
  ariaLabel: string;
  tone?: "brand" | "success" | "warning" | "error";
  /** sm: dar yerde (en fazla 10rem) küçük yazı — büyük yazı yaya çarpmasın. */
  size?: "sm" | "md";
  className?: string;
}

const YAY = {
  brand: "stroke-brand-500",
  success: "stroke-success-500",
  warning: "stroke-warning-500",
  error: "stroke-error-500",
} as const;

export function RadialGauge({ value, label, ariaLabel, tone = "brand", size = "md", className }: RadialGaugeProps) {
  const yuzde = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const yazi = label ?? `%${Math.round(yuzde)}`;
  return (
    <div role="img" aria-label={`${ariaLabel}: %${Math.round(yuzde)}`} className={cx("relative mx-auto w-full", size === "sm" ? "max-w-40" : "max-w-[18rem]", className)}>
      <svg viewBox="0 0 200 110" className="block w-full rtl:-scale-x-100" aria-hidden>
        <path d="M 14 100 A 86 86 0 0 1 186 100" pathLength={100} fill="none" strokeWidth={14} strokeLinecap="round" className="stroke-gray-200" />
        {yuzde > 0 ? (
          <path
            d="M 14 100 A 86 86 0 0 1 186 100"
            pathLength={100}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${yuzde} 100`}
            className={YAY[tone]}
          />
        ) : null}
      </svg>
      <span
        aria-hidden
        className={cx(
          "tabular absolute inset-x-0 bottom-1 text-center font-display font-semibold text-gray-800",
          size === "sm" ? "text-xl" : "text-title-sm sm:text-title-md"
        )}
      >
        {yazi}
      </span>
    </div>
  );
}
