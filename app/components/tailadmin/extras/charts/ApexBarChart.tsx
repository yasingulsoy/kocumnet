"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/charts/bar/BarChartOne.tsx
 * ve components/ecommerce/MonthlySalesChart.tsx
 * Bağımlılık ve LİSANS: ./ApexChart.tsx başındaki not.
 *
 * Sütun grafiği: %39 sütun, üstte 5px yuvarlak köşe, üstte sola yaslı
 * açıklama, üstüne gelince solma yok. Bağımlılıksız eşi: charts/BarChart.
 * Tam sayı verisinde değer ekseni tam sayı (tamSayiOlcegi). Yatayda
 * (horizontal) uzun kategori adı eksende kısalır; ipucu adın tamamını gösterir.
 */
import type { ApexOptions } from "apexcharts";
import { ApexChart, GRAFIK_RENKLERI, tamSayiOlcegi, temelAyarlar } from "./ApexChart";

export interface ApexBarChartProps {
  categories: string[];
  series: { name: string; data: number[] }[];
  ariaLabel: string;
  height?: number;
  horizontal?: boolean;
  valueFormat?: (deger: number) => string;
  className?: string;
}

export function ApexBarChart({ categories, series, ariaLabel, height = 180, horizontal = false, valueFormat = (d) => `${d}`, className }: ApexBarChartProps) {
  const temel = temelAyarlar();
  // Değer ekseni: dikeyde yaxis, yatayda (ApexCharts'ta) xaxis'in etiketleri.
  const olcek = tamSayiOlcegi(series);
  const options: ApexOptions = {
    ...temel,
    colors: [GRAFIK_RENKLERI.brand500, GRAFIK_RENKLERI.brand300],
    chart: { ...temel.chart, type: "bar", height },
    plotOptions: { bar: { horizontal, columnWidth: "39%", borderRadius: 5, borderRadiusApplication: "end" } },
    stroke: { show: true, width: 4, colors: ["transparent"] },
    xaxis: {
      categories,
      tickPlacement: "on",
      axisBorder: { show: false },
      axisTicks: { show: false },
      ...(olcek && horizontal ? { tickAmount: olcek.tickAmount } : {}),
      labels: {
        style: { colors: GRAFIK_RENKLERI.gray500, fontSize: "12px" },
        ...(olcek && horizontal ? { formatter: (v: string) => olcek.formatter(Number(v)) } : {}),
      },
    },
    yaxis: {
      title: { text: undefined },
      ...(olcek ? { min: olcek.min, forceNiceScale: olcek.forceNiceScale } : {}),
      ...(olcek && !horizontal ? { tickAmount: olcek.tickAmount } : {}),
      labels: {
        style: { colors: [GRAFIK_RENKLERI.gray500], fontSize: "12px" },
        ...(olcek && !horizontal ? { formatter: olcek.formatter } : {}),
      },
    },
    legend: { ...temel.legend, show: series.length > 1, position: "top", horizontalAlign: "left" },
    grid: { ...temel.grid, yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
    tooltip: { ...temel.tooltip, x: { show: horizontal }, y: { formatter: (v: number) => valueFormat(v) } },
  };
  return (
    <div className="custom-scrollbar max-w-full overflow-x-auto">
      <div className="min-w-[40rem] xl:min-w-full">
        <ApexChart type="bar" options={options} series={series} height={height} ariaLabel={ariaLabel} className={className} />
      </div>
    </div>
  );
}
