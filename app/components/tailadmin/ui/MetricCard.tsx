/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/EcommerceMetrics.tsx
 *
 * Tek sayı kartı: ikon kutusu, etiket, büyük sayı, sağda isteğe bağlı rozet
 * (değişim, durum). Grafik bağımlılığı yok. `href` verilirse bütün kart
 * bağlantı olur. Sayı Poppins ve hizalı rakam (tabular). `compact`:
 * telefonda (sm altı) küçük ikon, dar boşluk, küçük sayı — 2x2 dizilen dört
 * kart telefon ekranını doldurmasın; geniş ekranda değişmez.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../cx";

export type MetricTone = "gray" | "brand" | "success" | "warning" | "error";

const IKON_TONU: Record<MetricTone, string> = {
  gray: "bg-gray-100 text-gray-800",
  brand: "bg-brand-50 text-brand-500",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  error: "bg-error-50 text-error-600",
};

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  /** Sayının yanında: <Badge color="success">+%11</Badge> gibi. */
  badge?: ReactNode;
  /** Sayının altında küçük not. */
  hint?: ReactNode;
  href?: string;
  tone?: MetricTone;
  /** Telefonda (sm altı) sıkı görünüm. */
  compact?: boolean;
  className?: string;
}

export function MetricCard({ label, value, icon, badge, hint, href, tone = "gray", compact = false, className }: MetricCardProps) {
  const ic = (
    <>
      {icon ? (
        <div
          className={cx(
            "flex size-12 items-center justify-center rounded-xl [&_svg]:size-6",
            compact && "max-sm:size-10 max-sm:[&_svg]:size-5",
            IKON_TONU[tone]
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className={cx("flex items-end justify-between gap-3", icon && "mt-5", icon && compact && "max-sm:mt-3")}>
        <div className="min-w-0">
          <span className="text-sm text-gray-500">{label}</span>
          <p className={cx("tabular mt-2 font-display text-title-sm font-bold text-gray-800", compact && "max-sm:mt-1 max-sm:text-2xl")}>
            {value}
          </p>
        </div>
        {badge ? <div className="shrink-0 pb-1">{badge}</div> : null}
      </div>
      {hint ? <p className="mt-1.5 text-theme-xs text-gray-500">{hint}</p> : null}
    </>
  );
  const kart = cx("block rounded-2xl border border-gray-200 bg-white p-5 md:p-6", compact && "max-sm:p-4", className);
  if (href) {
    return (
      <Link href={href} className={cx(kart, "transition hover:border-gray-300 hover:shadow-theme-md")}>
        {ic}
      </Link>
    );
  }
  return <div className={kart}>{ic}</div>;
}
