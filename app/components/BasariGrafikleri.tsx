"use client";

import { useSyncExternalStore } from "react";
import type { ApexOptions } from "apexcharts";
import { ApexChart, GRAFIK_RENKLERI, temelAyarlar } from "@/components/tailadmin/extras/charts/ApexChart";

/*
 * Öğrencinin başarı grafikleri — kitin ApexCharts eklentisi (extras/charts).
 * Kütüphane ApexChart'ın içinde next/dynamic + ssr:false ile yüklenir:
 * grafiği olmayan sayfa indirmez. Veri sunucuda hazırlanır, buraya yalnızca
 * düz sayılar ve metinler gelir.
 *
 * Neden kitin ApexAreaChart'ı değil: başarı oranı her zaman 0-100 ekseninde
 * ve yüzdeyle okunmalı (ölçeği veriye göre oynayan eksen %40'tan %45'e
 * çıkışı uçurum gibi gösterir), her noktanın balonunda hangi test olduğu
 * yazmalı ve telefonda grafik yana kaymadan karta sığmalı.
 *
 * Çizimin yanında görünmez veri tablosu: ekran okuyucu ve JavaScript'siz
 * okuyucu sayıları oradan alır.
 */

export interface BasariNoktasi {
  /** Eksen etiketi (kısa tarih). */
  etiket: string;
  /** 0-100 */
  deger: number;
  /** Balonda ve tabloda: "TYT Çekirdek · 12,50 net". */
  ayrinti: string;
}

const HAREKET_SORGUSU = "(prefers-reduced-motion: reduce)";

function hareketeAbone(degisti: () => void) {
  const mq = window.matchMedia(HAREKET_SORGUSU);
  mq.addEventListener("change", degisti);
  return () => mq.removeEventListener("change", degisti);
}

/** "Hareketi azalt" tercihi: grafik açılış animasyonu kapanır. */
function useHareketAzalt() {
  return useSyncExternalStore(
    hareketeAbone,
    () => window.matchMedia(HAREKET_SORGUSU).matches,
    () => true
  );
}

const yuzde = (v: number) => `%${Math.round(v)}`;

/** Başarı oranı bandı — pano şeridindeki eşiklerle aynı (%75 / %45). */
function bantRengi(deger: number) {
  return deger >= 75 ? GRAFIK_RENKLERI.success500 : deger >= 45 ? GRAFIK_RENKLERI.warning500 : GRAFIK_RENKLERI.error500;
}

function ortakEksenler(noktalar: BasariNoktasi[]): Pick<ApexOptions, "xaxis" | "yaxis"> {
  return {
    xaxis: {
      type: "category",
      categories: noktalar.map((n) => n.etiket),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        trim: true,
        style: { colors: GRAFIK_RENKLERI.gray500, fontSize: "12px" },
      },
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 4,
      labels: { formatter: yuzde, style: { colors: [GRAFIK_RENKLERI.gray500], fontSize: "12px" } },
    },
  };
}

/**
 * Görünmez tablo bir sr-only KABIN içinde: tabloya doğrudan sr-only verince
 * tablo 1 piksele daralmıyor (tablolar genişliği içerikten alır) ve telefonda
 * sayfayı sağa taşırıyordu.
 */
function VeriTablosu({ baslik, noktalar }: { baslik: string; noktalar: BasariNoktasi[] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{baslik}</caption>
        <thead>
          <tr>
            <th scope="col">Tarih</th>
            <th scope="col">Test</th>
            <th scope="col">Başarı</th>
          </tr>
        </thead>
        <tbody>
          {noktalar.map((n, i) => (
            <tr key={i}>
              <th scope="row">{n.etiket}</th>
              <td>{n.ayrinti}</td>
              <td>{yuzde(n.deger)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Başarı eğilimi (alan grafiği): her nokta bir ölçüm. Gelişim sayfası.
 * En az iki nokta ver; tek noktada çizgi anlam taşımıyor.
 */
export function BasariEgilimi({
  noktalar,
  ariaLabel,
  height = 280,
}: {
  noktalar: BasariNoktasi[];
  ariaLabel: string;
  height?: number;
}) {
  const azalt = useHareketAzalt();
  const temel = temelAyarlar();
  const options: ApexOptions = {
    ...temel,
    colors: [GRAFIK_RENKLERI.brand500],
    chart: { ...temel.chart, type: "area", height, animations: { enabled: !azalt } },
    stroke: { curve: "straight", width: 2.5 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0 } },
    markers: {
      size: noktalar.length > 24 ? 0 : 4,
      colors: ["#ffffff"],
      strokeColors: GRAFIK_RENKLERI.brand500,
      strokeWidth: 2,
      hover: { size: 6 },
    },
    grid: { ...temel.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } }, padding: { left: 4, right: 12 } },
    ...ortakEksenler(noktalar),
    tooltip: {
      ...temel.tooltip,
      x: { formatter: (_v: number, o?: { dataPointIndex?: number }) => noktalar[o?.dataPointIndex ?? 0]?.ayrinti ?? "" },
      y: { formatter: yuzde },
    },
  };
  return (
    <>
      <ApexChart
        type="area"
        options={options}
        series={[{ name: "Başarı", data: noktalar.map((n) => Math.round(n.deger)) }]}
        height={height}
        ariaLabel={ariaLabel}
      />
      <VeriTablosu baslik={ariaLabel} noktalar={noktalar} />
    </>
  );
}

/**
 * Son testler (sütun grafiği): her sütun bir ölçüm, rengi başarı bandı
 * (yeşil %75+, turuncu %45+, kırmızı altı) — panodaki eski ilerleme
 * şeridinin anlamı. Pano.
 */
export function SonTestlerGrafigi({
  noktalar,
  ariaLabel,
  height = 220,
}: {
  noktalar: BasariNoktasi[];
  ariaLabel: string;
  height?: number;
}) {
  const azalt = useHareketAzalt();
  const temel = temelAyarlar();
  const options: ApexOptions = {
    ...temel,
    colors: noktalar.map((n) => bantRengi(n.deger)),
    chart: { ...temel.chart, type: "bar", height, animations: { enabled: !azalt } },
    plotOptions: {
      bar: { distributed: true, columnWidth: noktalar.length > 6 ? "55%" : "39%", borderRadius: 5, borderRadiusApplication: "end" },
    },
    legend: { show: false },
    grid: { ...temel.grid, yaxis: { lines: { show: true } }, padding: { left: 4, right: 8 } },
    ...ortakEksenler(noktalar),
    states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
    tooltip: {
      ...temel.tooltip,
      x: { formatter: (_v: number, o?: { dataPointIndex?: number }) => noktalar[o?.dataPointIndex ?? 0]?.ayrinti ?? "" },
      y: { formatter: yuzde, title: { formatter: () => "Başarı: " } },
    },
  };
  return (
    <>
      <ApexChart
        type="bar"
        options={options}
        series={[{ name: "Başarı", data: noktalar.map((n) => Math.round(n.deger)) }]}
        height={height}
        ariaLabel={ariaLabel}
      />
      <VeriTablosu baslik={ariaLabel} noktalar={noktalar} />
    </>
  );
}
