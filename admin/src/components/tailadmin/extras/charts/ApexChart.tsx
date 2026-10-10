"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/charts/*, components/ecommerce/*Chart.tsx
 * (dinamik içe aktarma kalıbı ve ortak ApexCharts ayarları)
 *
 * Bağımlılık: apexcharts + react-apexcharts
 *   `npx npm@10.9.4 install apexcharts react-apexcharts`
 *
 * ⚠ LİSANS: ApexCharts MIT DEĞİL. Topluluk lisansı yalnızca yıllık geliri
 * 2 milyon USD'nin altındaki kuruluşlara ücretsiz; paketi kurmak lisansı
 * kabul etmek sayılıyor (paketin LICENSE dosyası). Bir projede açmadan önce
 * ürün sahibinin onayı gerekir — README "Eklentiler". Lisans istemeyen
 * yerler için bağımlılıksız charts/ (BarChart, RadialGauge, MeterList).
 *
 * Grafik yalnızca tarayıcıda çizilir (next/dynamic, ssr:false): grafiği
 * kullanmayan sayfa kütüphaneyi indirmez. İnen de kütüphanenin tamamı değil:
 * react-apexcharts'ın `core` sürümü + kitin kullandığı grafik türleri (çizgi/
 * alan, sütun, yarım daire) ve açıklama (legend). Tam paket ~1 MB (gzip ~290
 * KB) idi. Yeni bir tür (pie, heatmap…) kullanılacaksa buraya eklenir.
 */
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { Props as ReactApexChartProps } from "react-apexcharts";
import "./charts.css";

const ReactApexChart = dynamic(
  async () => {
    const [{ default: Grafik }] = await Promise.all([
      import("react-apexcharts/core"),
      import("apexcharts/line"),
      import("apexcharts/area"),
      import("apexcharts/bar"),
      import("apexcharts/radialBar"),
      import("apexcharts/features/legend"),
    ]);
    return Grafik;
  },
  {
    ssr: false,
    loading: () => <div aria-hidden className="size-full min-h-24 animate-pulse rounded-lg bg-gray-100" />,
  }
);

/** Kit renkleri (ApexCharts düz renk ister; değerler theme.css ile aynı). */
export const GRAFIK_RENKLERI = {
  brand500: "#1a5fb4",
  brand300: "#8db7f1",
  brand200: "#b6d2f8",
  gray100: "#f2f4f7",
  gray200: "#e4e7ec",
  gray500: "#667085",
  gray700: "#344054",
  gray800: "#1d2939",
  success500: "#12b76a",
  warning500: "#f79009",
  error500: "#f04438",
} as const;

/** Bütün kit grafiklerinin ortak ayarları: sayfanın yazı tipi, araç çubuğu ve yakınlaştırma kapalı. */
export function temelAyarlar(): ApexOptions {
  return {
    chart: { fontFamily: "inherit", toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    grid: { borderColor: GRAFIK_RENKLERI.gray100 },
    legend: { fontFamily: "inherit", labels: { colors: GRAFIK_RENKLERI.gray700 } },
    tooltip: { theme: "light" },
  };
}

/**
 * Bütün değerler tam sayıysa (sayım: mesaj, okunma) değer ekseni de tam
 * sayı olsun: ApexCharts küçük sayılarda 0.2, 0.4… adımları çiziyordu
 * ("0.4 mesaj"). En büyük değer 5'ten küçükse her tam sayıya bir çizgi,
 * değilse yuvarlak tam sayı adımları. Kesirli veride null (kütüphanenin ölçeği).
 */
export function tamSayiOlcegi(series: { data: number[] }[]) {
  const degerler = series.flatMap((s) => s.data);
  if (!degerler.length || !degerler.every((d) => Number.isInteger(d))) return null;
  return {
    min: 0,
    tickAmount: Math.min(5, Math.max(1, ...degerler)),
    forceNiceScale: true,
    formatter: (v: number) => `${Math.round(v)}`,
  };
}

export interface ApexChartProps extends ReactApexChartProps {
  /** Ekran okuyucu için grafiğin özeti. */
  ariaLabel: string;
  className?: string;
}

export function ApexChart({ ariaLabel, className, height, ...props }: ApexChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} className={className} style={{ minHeight: typeof height === "number" ? height : undefined }}>
      <ReactApexChart height={height} {...props} />
    </div>
  );
}
