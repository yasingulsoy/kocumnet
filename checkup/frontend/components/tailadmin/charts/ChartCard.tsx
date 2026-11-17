/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/MonthlySalesChart.tsx,
 * StatisticsChart.tsx ve MonthlyTarget.tsx'in kart kabukları
 *
 * Grafik kartı: başlık + alt başlık, sağda eylem (sekme, bağlantı), gövde
 * (grafik), isteğe bağlı alt şerit. `stats` verilirse MonthlyTarget'taki
 * gibi gri zeminli alt şeritte, dikey çizgiyle ayrılmış küçük sayılar.
 * Grafik kütüphanesinden bağımsız: içine BarChart, RadialGauge, MeterList
 * ya da extras/charts bileşenleri konur.
 */
import { Fragment, type ReactNode } from "react";
import { cx } from "../cx";

export interface ChartStat {
  label: ReactNode;
  value: ReactNode;
}

export interface ChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Kartın altında, gri şeritte küçük sayılar. */
  stats?: ChartStat[];
  /** Gövdenin altında serbest metin (stats'ın üstünde). */
  note?: ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}

export function ChartCard({ title, description, actions, children, stats, note, className, titleAs: Baslik = "h2" }: ChartCardProps) {
  const ic = (
    <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Baslik className="font-display text-lg font-semibold text-gray-800">{title}</Baslik>
          {description ? <p className="mt-1 text-theme-sm text-gray-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
      {note ? <div className="mx-auto mt-4 max-w-95 text-center text-sm text-gray-500">{note}</div> : null}
    </div>
  );

  if (!stats?.length) {
    return <section className={cx("min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white", className)}>{ic}</section>;
  }

  return (
    <section className={cx("min-w-0 rounded-2xl border border-gray-200 bg-gray-100", className)}>
      <div className="rounded-2xl bg-white shadow-theme-xs">{ic}</div>
      <dl className="flex items-center justify-center gap-5 px-6 py-3 sm:gap-8 sm:py-5">
        {stats.map((s, i) => (
          <Fragment key={i}>
            {i > 0 ? <div aria-hidden className="h-7 w-px bg-gray-200" /> : null}
            <div className="flex flex-col items-center">
              <dt className="mb-1 text-center text-theme-xs text-gray-500 sm:text-sm">{s.label}</dt>
              <dd className="tabular text-base font-semibold text-gray-800 sm:text-lg">{s.value}</dd>
            </div>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
