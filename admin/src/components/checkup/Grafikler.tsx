"use client";

import { useState } from "react";
import type { ApexOptions } from "apexcharts";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { ApexChart, GRAFIK_RENKLERI, temelAyarlar } from "@/components/tailadmin/extras/charts/ApexChart";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

/**
 * Panelin etkileşimli grafikleri — kitin ApexCharts eklentisi
 * (extras/charts): ApexChart sarmalayıcısı kütüphaneyi yalnızca tarayıcıda
 * yükler (next/dynamic, ssr: false). Görünüm kitin ortak ayarları
 * (temelAyarlar, GRAFIK_RENKLERI); burada yalnızca panelin ihtiyacı:
 * tamsayı sayım ekseni, 0-100 yüzde ekseni, renkli dağılım sütunları.
 *
 * Veriler sunucuda gerçek kayıtlardan hesaplanır, buraya düz dizi gelir;
 * alıştırma oturumları (PRACTICE) sorgularda zaten dışarıda.
 */

type YEkseni = Exclude<NonNullable<ApexOptions["yaxis"]>, unknown[]>;

const X_ETIKET = { style: { colors: GRAFIK_RENKLERI.gray500, fontSize: "12px" } };
const Y_ETIKET = { style: { colors: [GRAFIK_RENKLERI.gray500], fontSize: "12px" } };
const tamsayi = (v: number) => Math.round(v).toLocaleString("tr-TR");

/**
 * Sayım ekseni: 1-2-5 dizisinden üst sınır ve adım. ApexCharts küçük
 * sayılarda 0,5'lik ara çizgi koyuyordu ("1,5 test" anlamsız).
 */
function sayimEkseni(enBuyuk: number): YEkseni {
  const tepe = Math.max(enBuyuk, 1);
  const kaba = tepe / 4;
  const us = 10 ** Math.floor(Math.log10(kaba));
  const adim = Math.max(1, [1, 2, 5, 10].map((k) => k * us).find((a) => a >= kaba) ?? 10 * us);
  const ust = Math.ceil(tepe / adim) * adim;
  return { min: 0, max: ust, tickAmount: Math.round(ust / adim), labels: { ...Y_ETIKET, formatter: tamsayi } };
}

/** Sütun grafiğinin ortak ayarları (TailAdmin MonthlySalesChart görünümü). */
function sutunAyarlari(categories: string[] | string[][], enBuyuk: number): ApexOptions {
  const temel = temelAyarlar();
  return {
    ...temel,
    chart: { ...temel.chart, type: "bar" },
    plotOptions: { bar: { columnWidth: "45%", borderRadius: 5, borderRadiusApplication: "end" } },
    stroke: { show: true, width: 4, colors: ["transparent"] },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { ...X_ETIKET, rotate: 0, hideOverlappingLabels: false },
    },
    yaxis: sayimEkseni(enBuyuk),
    grid: { ...temel.grid, yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
    tooltip: { ...temel.tooltip, y: { formatter: (v: number) => tamsayi(v) + " soru" } },
  };
}

// ─── Genel bakış: testler ve kayıtlar ─────────────────────────

export interface DonemGorunumu {
  key: string;
  label: string;
  /** Kartın açıklaması (bu dönemin toplamları). */
  aciklama: string;
  categories: string[];
  test: number[];
  kayit: number[];
}

/** Tamamlanan test ve yeni kayıt — günlük ya da haftalık, sekmeyle. */
export function TestGrafigi({ gorunumler }: { gorunumler: DonemGorunumu[] }) {
  const [secili, setSecili] = useState(gorunumler[0]?.key ?? "");
  const g = gorunumler.find((v) => v.key === secili) ?? gorunumler[0];
  if (!g) return null;

  const temel = temelAyarlar();
  const options: ApexOptions = {
    ...temel,
    colors: [GRAFIK_RENKLERI.brand500, GRAFIK_RENKLERI.brand300],
    chart: { ...temel.chart, type: "area" },
    stroke: { curve: "smooth", width: [2, 2] },
    fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0 } },
    markers: { size: 0, strokeColors: "#fff", strokeWidth: 2, hover: { size: 5 } },
    legend: { ...temel.legend, position: "top", horizontalAlign: "left" },
    grid: { ...temel.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: {
      type: "category",
      categories: g.categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: { ...X_ETIKET, rotate: 0, hideOverlappingLabels: true },
    },
    yaxis: sayimEkseni(Math.max(0, ...g.test, ...g.kayit)),
    tooltip: { ...temel.tooltip, y: { formatter: tamsayi } },
  };

  return (
    <ChartCard
      title="Testler ve kayıtlar"
      description={g.aciklama}
      actions={
        gorunumler.length > 1 ? (
          <SegmentedTabs
            label="Dönem"
            items={gorunumler.map((v) => ({ key: v.key, label: v.label, active: v.key === g.key, onClick: () => setSecili(v.key) }))}
          />
        ) : null
      }
    >
      <ApexChart
        // Dönem değişince grafik baştan kurulsun (kategori sayısı değişiyor).
        key={g.key}
        type="area"
        height={260}
        options={options}
        series={[
          { name: "Tamamlanan test", data: g.test },
          { name: "Yeni kayıt", data: g.kayit },
        ]}
        ariaLabel={g.label + ": " + g.aciklama}
      />
    </ChartCard>
  );
}

// ─── Öğrenci: başarı eğilimi ───────────────────────────────────

export interface PuanNoktasi {
  /** Eksendeki kısa tarih ("4 Eki"). */
  etiket: string;
  /** Balondaki başlık: paket ve tarih. */
  baslik: string;
  /** 0-100, doğru / sorulan. */
  basari: number;
  net: number;
  /** Sınav adı; farklı sınavlar aynı çizgide karışmaz. */
  sinav: string;
}

/**
 * Öğrencinin ölçüm testlerindeki başarısı. Farklı sınavlar tek çizgide
 * toplanmaz (öğrenci uygulamasının Gelişim ekranıyla aynı karar): birden
 * fazla sınav varsa sekmeyle seçilir.
 */
export function PuanTrendi({ noktalar, varsayilanSinav }: { noktalar: PuanNoktasi[]; varsayilanSinav?: string | null }) {
  const sinavlar = [...new Set(noktalar.map((n) => n.sinav))];
  const [secili, setSecili] = useState(
    varsayilanSinav && sinavlar.includes(varsayilanSinav) ? varsayilanSinav : (noktalar.at(-1)?.sinav ?? "")
  );
  const gorunen = noktalar.filter((n) => n.sinav === secili);

  const temel = temelAyarlar();
  const options: ApexOptions = {
    ...temel,
    colors: [GRAFIK_RENKLERI.brand500],
    chart: { ...temel.chart, type: "area" },
    stroke: { curve: "straight", width: 2 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.4, opacityTo: 0 } },
    markers: { size: 4, strokeColors: "#fff", strokeWidth: 2, hover: { size: 6 } },
    grid: { ...temel.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: {
      type: "category",
      categories: gorunen.map((n) => n.etiket),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: { ...X_ETIKET, rotate: 0, hideOverlappingLabels: true },
    },
    // Eksen hep 0-100: küçük bir değişim uçurum gibi görünmesin.
    yaxis: { min: 0, max: 100, tickAmount: 4, labels: { ...Y_ETIKET, formatter: (v: number) => "%" + Math.round(v) } },
    tooltip: {
      ...temel.tooltip,
      x: { formatter: (_: unknown, o?: { dataPointIndex?: number }) => gorunen[o?.dataPointIndex ?? -1]?.baslik ?? "" },
      y: {
        formatter: (v: number, o?: { dataPointIndex?: number }) => {
          const n = gorunen[o?.dataPointIndex ?? -1];
          return "%" + Math.round(v) + (n ? " · " + n.net.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " net" : "");
        },
      },
    },
  };

  return (
    <ChartCard
      title="Başarı eğilimi"
      description="Ölçüm testleri (kontrol testleri hariç), doğru / sorulan."
      actions={
        sinavlar.length > 1 ? (
          <SegmentedTabs
            label="Sınav"
            items={sinavlar.map((s) => ({ key: s, label: s, active: s === secili, onClick: () => setSecili(s) }))}
          />
        ) : null
      }
    >
      {gorunen.length < 2 ? (
        <p className="py-8 text-center text-theme-sm text-gray-500">
          Eğilim için bu sınavda en az iki tamamlanmış test gerekiyor{gorunen.length === 1 ? " (şu an bir tane var)" : ""}.
        </p>
      ) : (
        <ApexChart
          key={secili}
          type="area"
          height={240}
          options={options}
          series={[{ name: "Başarı", data: gorunen.map((n) => n.basari) }]}
          ariaLabel={
            secili +
            " başarı eğilimi: " +
            gorunen.length +
            " test, ilk %" +
            Math.round(gorunen[0].basari) +
            ", son %" +
            Math.round(gorunen[gorunen.length - 1].basari)
          }
        />
      )}
    </ChartCard>
  );
}

// ─── Madde analizi: dağılımlar ─────────────────────────────────

/** İki satırlık eksen etiketi: dar ekranda da kırpılmasın. */
const ZORLUK_ETIKETLERI = [
  ["1", "çok kolay"],
  ["2", "kolay"],
  ["3", "orta"],
  ["4", "zor"],
  ["5", "çok zor"],
];

/**
 * Zorluk etiketi ile gözlenen zorluğun dağılımı (1-5). İki sütun birbirinden
 * çok ayrılıyorsa seçim kolay/orta/zor bantlarını yanlış dolduruyor.
 */
export function ZorlukGrafigi({ etiketlenen, gozlenen }: { etiketlenen: number[]; gozlenen: number[] }) {
  const options: ApexOptions = {
    ...sutunAyarlari(ZORLUK_ETIKETLERI, Math.max(0, ...etiketlenen, ...gozlenen)),
    colors: [GRAFIK_RENKLERI.brand500, GRAFIK_RENKLERI.brand300],
    legend: { ...temelAyarlar().legend, show: true, position: "top", horizontalAlign: "left" },
  };
  const toplam = etiketlenen.reduce((t, n) => t + n, 0);
  return (
    <ApexChart
      type="bar"
      height={240}
      options={options}
      series={[
        { name: "Etiketlenen zorluk", data: etiketlenen },
        { name: "Gözlenen zorluk", data: gozlenen },
      ]}
      ariaLabel={
        toplam +
        " sorunun zorluk dağılımı. Etiketlenen: " +
        etiketlenen.map((n, i) => i + 1 + ": " + n).join(", ") +
        ". Gözlenen: " +
        gozlenen.map((n, i) => i + 1 + ": " + n).join(", ")
      }
    />
  );
}

const AYIRT_ETIKETLERI = ["Ters", "Zayıf", "Orta", "İyi"];

/** Ayırt edicilik bantları: ters ve zayıf sorular önce gözden geçirilir. */
export function AyirtEdicilikGrafigi({ sayilar }: { sayilar: [ters: number, zayif: number, orta: number, iyi: number] }) {
  const options: ApexOptions = {
    ...sutunAyarlari(AYIRT_ETIKETLERI, Math.max(0, ...sayilar)),
    colors: [GRAFIK_RENKLERI.error500, GRAFIK_RENKLERI.warning500, GRAFIK_RENKLERI.brand300, GRAFIK_RENKLERI.success500],
    plotOptions: { bar: { columnWidth: "45%", borderRadius: 5, borderRadiusApplication: "end", distributed: true } },
    legend: { show: false },
  };
  return (
    <ApexChart
      type="bar"
      height={240}
      options={options}
      series={[{ name: "Soru", data: sayilar }]}
      ariaLabel={"Ayırt edicilik dağılımı: " + AYIRT_ETIKETLERI.map((e, i) => e + " " + sayilar[i]).join(", ")}
    />
  );
}
