"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/charts/line/LineChartOne.tsx
 * Bağımlılık ve LİSANS: ./ApexChart.tsx başındaki not.
 *
 * Alan grafiği: iki seriye kadar, gradyan dolgu, düz çizgi, yalnızca yatay
 * ızgara. Renkler marka mavisi (500) ve açığı (300). Tam sayı verisinde
 * eksen tam sayı (tamSayiOlcegi).
 */
import type { ApexOptions } from "apexcharts";
import { ApexChart, GRAFIK_RENKLERI, tamSayiOlcegi, temelAyarlar } from "./ApexChart";

export interface ApexAreaChartProps {
  categories: string[];
  series: { name: string; data: number[] }[];
  ariaLabel: string;
  height?: number;
  curve?: "straight" | "smooth";
  className?: string;
}

export function ApexAreaChart({ categories, series, ariaLabel, height = 310, curve = "straight", className }: ApexAreaChartProps) {
  const temel = temelAyarlar();
  const olcek = tamSayiOlcegi(series);
  const options: ApexOptions = {
    ...temel,
    legend: { ...temel.legend, show: false, position: "top", horizontalAlign: "left" },
    colors: [GRAFIK_RENKLERI.brand500, GRAFIK_RENKLERI.brand300],
    chart: { ...temel.chart, type: "area", height },
    stroke: { curve, width: [2, 2] },
    fill: { type: "gradient", gradient: { opacityFrom: 0.55, opacityTo: 0 } },
    markers: { size: 0, strokeColors: "#fff", strokeWidth: 2, hover: { size: 6 } },
    grid: { ...temel.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: {
      type: "category",
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: { style: { colors: GRAFIK_RENKLERI.gray500, fontSize: "12px" } },
    },
    yaxis: {
      ...(olcek ? { min: olcek.min, tickAmount: olcek.tickAmount, forceNiceScale: olcek.forceNiceScale } : {}),
      labels: { style: { fontSize: "12px", colors: [GRAFIK_RENKLERI.gray500] }, ...(olcek ? { formatter: olcek.formatter } : {}) },
    },
  };
  return (
    <div className="custom-scrollbar max-w-full overflow-x-auto">
      <div className="min-w-[40rem] xl:min-w-full">
        <ApexChart type="area" options={options} series={series} height={height} ariaLabel={ariaLabel} className={className} />
      </div>
    </div>
  );
}
