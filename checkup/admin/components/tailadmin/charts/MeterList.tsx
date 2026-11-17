/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/DemographicCard.tsx
 * (ülke satırları: ad + alt bilgi solda, ince çubuk + yüzde sağda)
 *
 * Sıralı liste ve yatay çubuk: "en çok okunan yazılar" gibi. Çubuk, en
 * büyük değere (ya da `max`'a) göre oranlanır. Satır bağlantı olabilir.
 * Eklenenler: satır başına çubuk rengi (`tone`: güçlü/orta/zayıf gibi
 * anlamı olan listeler), adın yanında rozet (`badge`) ve `wrap`: uzun ad
 * kesilmez, alt satıra geçer (telefonda konu adları okunur kalsın).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../cx";

export type MeterTone = "brand" | "success" | "warning" | "error" | "gray";

const CUBUK: Record<MeterTone, string> = {
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  gray: "bg-gray-400",
};

export interface MeterItem {
  key: string | number;
  label: ReactNode;
  value: number;
  /** Değerin yanında yazılan metin; yoksa sayı. */
  valueLabel?: ReactNode;
  /** Etiketin altında küçük gri satır. */
  meta?: ReactNode;
  href?: string;
  /** Çubuğun rengi (brand). */
  tone?: MeterTone;
  /** Adın hemen yanında (seviye rozeti gibi). */
  badge?: ReactNode;
}

export interface MeterListProps {
  items: MeterItem[];
  max?: number;
  /** true: ad ve alt satır kesilmez, sığmazsa alt satıra geçer. */
  wrap?: boolean;
  className?: string;
}

export function MeterList({ items, max, wrap = false, className }: MeterListProps) {
  const ust = max ?? Math.max(1, ...items.map((o) => o.value));
  return (
    <ul className={cx("space-y-5", className)}>
      {items.map((o) => {
        const oran = Math.max(0, Math.min(100, (o.value / ust) * 100));
        const ad = <span className={cx("block text-theme-sm font-semibold text-gray-800", wrap ? "min-w-0 break-words" : "truncate")}>{o.label}</span>;
        const etiket = (
          <span className="block min-w-0">
            {o.badge ? (
              <span className={cx("flex min-w-0 items-center gap-2", wrap && "flex-wrap gap-y-1")}>
                {ad}
                {o.badge}
              </span>
            ) : (
              ad
            )}
            {o.meta ? <span className={cx("block text-theme-xs text-gray-500", wrap ? "break-words" : "truncate")}>{o.meta}</span> : null}
          </span>
        );
        return (
          <li key={o.key} className="flex items-center justify-between gap-4">
            {o.href ? (
              <Link href={o.href} className="min-w-0 flex-1 transition hover:[&_span:first-child]:text-brand-500">
                {etiket}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{etiket}</div>
            )}
            <div className="flex w-full max-w-35 shrink-0 items-center gap-3">
              <div aria-hidden className="relative block h-2 w-full max-w-25 rounded-sm bg-gray-200">
                <div className={cx("absolute inset-y-0 start-0 rounded-sm", CUBUK[o.tone ?? "brand"])} style={{ width: `${oran}%` }} />
              </div>
              <p className="tabular min-w-8 text-end text-theme-sm font-medium text-gray-800">{o.valueLabel ?? o.value.toLocaleString("tr-TR")}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
