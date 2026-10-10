"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/MonthlyTarget.tsx (radialBar)
 * Bağımlılık ve LİSANS: ./ApexChart.tsx başındaki not.
 *
 * Yarım daire hedef göstergesi: -90°…90°, %80 boşluk, gri ray, yuvarlak
 * uç, ortada büyük yüzde. Bağımlılıksız eşi: charts/RadialGauge.
 */
import type { ApexOptions } from "apexcharts";
import { ApexChart, GRAFIK_RENKLERI, temelAyarlar } from "./ApexChart";

export interface ApexRadialChartProps {
  /** 0–100 */
  value: number;
  ariaLabel: string;
  height?: number;
  className?: string;
}

export function ApexRadialChart({ value, ariaLabel, height = 330, className }: ApexRadialChartProps) {
  const temel = temelAyarlar();
  const options: ApexOptions = {
    ...temel,
    colors: [GRAFIK_RENKLERI.brand500],
    chart: { ...temel.chart, type: "radialBar", height, sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: "80%" },
        track: { background: GRAFIK_RENKLERI.gray200, strokeWidth: "100%", margin: 5 },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: "36px",
            fontWeight: "600",
            offsetY: -35,
            color: GRAFIK_RENKLERI.gray800,
            formatter: (v: number) => `%${Math.round(v)}`,
          },
        },
      },
    },
    fill: { type: "solid", colors: [GRAFIK_RENKLERI.brand500] },
    stroke: { lineCap: "round" },
    labels: [ariaLabel],
  };
  return (
    <div className="max-h-45 overflow-hidden">
      <ApexChart type="radialBar" options={options} series={[Math.max(0, Math.min(100, value))]} height={height} ariaLabel={`${ariaLabel}: %${Math.round(value)}`} className={className} />
    </div>
  );
}
