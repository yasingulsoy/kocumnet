/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/MonthlySalesChart.tsx
 * ve components/charts/bar/BarChartOne.tsx'in görünümü, ApexCharts'sız.
 *
 * Bağımlılıksız sütun grafiği: TailAdmin'in ayarları (sütun genişliği %39,
 * üstte 5px yuvarlak köşe, yatay ızgara çizgileri, ekseni çizgisiz, 12px gri
 * etiketler) HTML/CSS ile. En fazla iki seri yan yana. Üstüne gelince değer
 * balonu; ekran okuyucu için görünmez veri tablosu (çizim aria-hidden).
 * ApexCharts lisansı kabul edilmeden de çalışır; etkileşimli grafik
 * gerekirse extras/charts.
 *
 *   <BarChart categories={["1 Eyl", "8 Eyl"]} series={[{ name: "Gelen", data: [4, 7] }]} ariaLabel="Haftalık gelen mesaj" />
 */
import { cx } from "../cx";

export interface BarSeries {
  name: string;
  data: number[];
}

export interface BarChartProps {
  categories: string[];
  series: BarSeries[];
  /** Grafiğin adı (görünmez tablo başlığı ve figür etiketi). */
  ariaLabel: string;
  /** Çizim alanı yüksekliği, piksel. */
  height?: number;
  valueFormat?: (deger: number) => string;
  /** Kategori etiketlerinden kaçta biri yazılsın (sıkışık eksen için). */
  labelEvery?: number;
  className?: string;
}

const RENK = ["bg-brand-500", "bg-brand-300"];
const NOKTA = ["bg-brand-500", "bg-brand-300"];

/** 1-2-5 dizisinden "güzel" bir üst sınır ve 4 aralık. */
function eksen(enBuyuk: number) {
  if (enBuyuk <= 0) return { ust: 4, adim: 1 };
  const kaba = enBuyuk / 4;
  const us = 10 ** Math.floor(Math.log10(kaba));
  const adim = [1, 2, 5, 10].map((k) => k * us).find((a) => a >= kaba) ?? 10 * us;
  const yuvarla = Math.max(1, adim);
  return { ust: Math.ceil(enBuyuk / yuvarla) * yuvarla, adim: yuvarla };
}

export function BarChart({ categories, series, ariaLabel, height = 180, valueFormat = (d) => d.toLocaleString("tr-TR"), labelEvery = 1, className }: BarChartProps) {
  const seriler = series.slice(0, 2);
  const enBuyuk = Math.max(0, ...seriler.flatMap((s) => s.data));
  const { ust, adim } = eksen(enBuyuk);
  const cizgiler: number[] = [];
  for (let d = 0; d <= ust; d += adim) cizgiler.push(d);

  return (
    <figure aria-label={ariaLabel} className={cx("w-full", className)}>
      {seriler.length > 1 ? (
        <figcaption aria-hidden className="mb-4 flex flex-wrap items-center gap-4 text-theme-xs text-gray-500">
          {seriler.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className={cx("size-2.5 rounded-full", NOKTA[i])} />
              {s.name}
            </span>
          ))}
        </figcaption>
      ) : null}

      <div aria-hidden className="grid grid-cols-[auto_1fr] gap-x-3">
        {/* y ekseni etiketleri */}
        <div className="relative" style={{ height }}>
          {cizgiler.map((d) => (
            <span key={d} className="tabular absolute end-0 translate-y-1/2 text-theme-xs leading-none text-gray-500" style={{ bottom: `${(d / ust) * 100}%` }}>
              {valueFormat(d)}
            </span>
          ))}
        </div>

        {/* çizim alanı */}
        <div className="relative" style={{ height }}>
          {cizgiler.map((d) => (
            <span key={d} className="absolute inset-x-0 border-t border-gray-100" style={{ bottom: `${(d / ust) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {categories.map((k, i) => (
              <div key={`${k}-${i}`} className="group relative flex h-full flex-1 items-end justify-center gap-1">
                {seriler.map((s, si) => {
                  const d = s.data[i] ?? 0;
                  return (
                    <span
                      key={s.name}
                      className={cx("max-w-8 rounded-t-[5px] transition-opacity group-hover:opacity-80", RENK[si], seriler.length > 1 ? "w-[30%]" : "w-[39%]")}
                      style={{ height: `${ust ? (d / ust) * 100 : 0}%`, minHeight: d > 0 ? 2 : 0 }}
                    />
                  );
                })}
                <span className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-start whitespace-nowrap shadow-theme-sm group-hover:block rtl:translate-x-1/2">
                  <span className="block text-[0.625rem] leading-4 text-gray-800">{k}</span>
                  {seriler.map((s, si) => (
                    <span key={s.name} className="mt-0.5 flex items-center gap-1.5 text-theme-xs text-gray-700">
                      <span className={cx("size-1.5 rounded-full", NOKTA[si])} />
                      {s.name}: <span className="font-medium">{valueFormat(s.data[i] ?? 0)}</span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* x ekseni etiketleri */}
        <div />
        {/* Etiket kendi sütununa sığmazsa yanlara taşar (labelEvery boş komşu bırakır). */}
        <div className="mt-2 flex">
          {categories.map((k, i) => (
            <span key={`${k}-${i}`} className="relative h-4 flex-1">
              {i % labelEvery === 0 ? (
                <span className="absolute start-1/2 top-0 -translate-x-1/2 text-theme-xs whitespace-nowrap text-gray-500 rtl:translate-x-1/2">{k}</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Dönem</th>
            {seriler.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((k, i) => (
            <tr key={`${k}-${i}`}>
              <th scope="row">{k}</th>
              {seriler.map((s) => (
                <td key={s.name}>{valueFormat(s.data[i] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
