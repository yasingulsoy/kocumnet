"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type SalesReportFilters = {
  from: string;
  to: string;
  granularity: "day" | "week" | "month";
  paid_only: boolean;
  exclude_deleted: boolean;
};

type AnalyticsBucket = {
  period: string;
  orders_count: number;
  revenue: number;
};

type PaymentSlice = {
  payment_method: string;
  orders_count: number;
  revenue: number;
};

type AnalyticsResponse = {
  success: boolean;
  data?: {
    range: SalesReportFilters;
    summary: {
      orders_count: number;
      revenue_total: number;
      avg_order_value: number;
    };
    timeseries: AnalyticsBucket[];
    payment_breakdown: PaymentSlice[];
  };
};

type SavedRow = {
  id: number;
  name: string;
  report_type: string;
  filters: SalesReportFilters;
  created_at: string;
  updated_at: string;
};

const currencyTry = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

function formatBucketLabel(iso: string, g: SalesReportFilters["granularity"]) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (g === "month") return d.toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
  if (g === "week")
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function analyticsQuery(f: SalesReportFilters) {
  const q = new URLSearchParams({
    from: f.from,
    to: f.to,
    granularity: f.granularity,
    paid_only: f.paid_only ? "true" : "false",
    exclude_deleted: f.exclude_deleted ? "true" : "false",
  });
  return `/api/admin/reports/sales/analytics?${q.toString()}`;
}

export default function SalesReportsClient() {
  const [filters, setFilters] = useState<SalesReportFilters>(() => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 29);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      granularity: "day",
      paid_only: true,
      exclude_deleted: true,
    };
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse["data"] | null>(null);

  const [savedList, setSavedList] = useState<SavedRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AnalyticsResponse>(analyticsQuery(filters));
      if (!res.success || !res.data) throw new Error("Veri alınamadı");
      setAnalytics(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rapor yüklenemedi");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await apiGet<{ success: boolean; data?: SavedRow[] }>(
        "/api/admin/reports/saved-queries?report_type=sales"
      );
      if (res.success && Array.isArray(res.data)) setSavedList(res.data);
      else setSavedList([]);
    } catch {
      setSavedList([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const categories = useMemo(
    () => (analytics?.timeseries || []).map((b) => formatBucketLabel(b.period, filters.granularity)),
    [analytics, filters.granularity]
  );

  const lineOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "area", height: 320, toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
      stroke: { curve: "smooth", width: 3 },
      dataLabels: { enabled: false },
      colors: ["#465fff"],
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] },
      },
      xaxis: { categories, labels: { rotate: filters.granularity === "day" ? -45 : 0 } },
      yaxis: {
        labels: {
          formatter: (v) =>
            `${Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`,
        },
      },
      tooltip: {
        shared: true,
        y: {
          formatter: (v) =>
            `${Number(v).toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ₺`,
        },
      },
      grid: { strokeDashArray: 4 },
    }),
    [categories, filters.granularity]
  );

  const lineSeries = useMemo(
    () => [
      {
        name: "Ciro",
        data: (analytics?.timeseries || []).map((b) => Math.round(Number(b.revenue) * 100) / 100),
      },
    ],
    [analytics]
  );

  const donutOptions: ApexOptions = useMemo(() => {
    const rows = analytics?.payment_breakdown || [];
    const labels = rows.map((r) => r.payment_method || "—");
    return {
      chart: { type: "donut", height: 320, fontFamily: "Outfit, sans-serif" },
      labels,
      legend: { position: "bottom" },
      colors: ["#465fff", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#64748b"],
      plotOptions: { pie: { donut: { size: "65%" } } },
    };
  }, [analytics]);

  const donutSeries = useMemo(() => {
    const rows = analytics?.payment_breakdown || [];
    return rows.map((r) => Math.round(Number(r.revenue) * 100) / 100);
  }, [analytics]);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - (days - 1));
    setFilters((prev) => ({
      ...prev,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }));
  };

  const handleSaveCurrent = async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await apiPost("/api/admin/reports/saved-queries", {
        name,
        report_type: "sales",
        filters,
      });
      setSaveName("");
      await fetchSaved();
    } finally {
      setSaving(false);
    }
  };

  const loadSavedFilters = (row: SavedRow) => {
    const f = row.filters;
    setFilters({
      from: f.from?.slice(0, 10) || filters.from,
      to: f.to?.slice(0, 10) || filters.to,
      granularity: ["day", "week", "month"].includes(f.granularity) ? f.granularity : "day",
      paid_only: f.paid_only !== false,
      exclude_deleted: f.exclude_deleted !== false,
    });
  };

  const handleDeleteSaved = async (id: number) => {
    if (!confirm("Bu kaydı silmek istiyor musunuz?")) return;
    await apiDelete(`/api/admin/reports/saved-queries/${id}`);
    await fetchSaved();
  };

  const startRename = (row: SavedRow) => {
    setRenameId(row.id);
    setRenameValue(row.name);
  };

  const commitRename = async () => {
    if (renameId == null || !renameValue.trim()) return;
    await apiPatch(`/api/admin/reports/saved-queries/${renameId}`, { name: renameValue.trim() });
    setRenameId(null);
    setRenameValue("");
    await fetchSaved();
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90 mb-2">Satış Raporları</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Tarih aralığına göre ciro ve sipariş adetleri; kayıtlı filtre kombinasyonlarını sonra tek tıkla
          kullanın.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: "Son 7 gün", days: 7 },
            { label: "Son 30 gün", days: 30 },
            { label: "Son 90 gün", days: 90 },
          ].map(({ label, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => applyPreset(days)}
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.05]"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 mb-6">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
            Başlangıç
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
            Bitiş
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
            Gruplama
            <select
              value={filters.granularity}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  granularity: e.target.value as SalesReportFilters["granularity"],
                }))
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="day">Gün</option>
              <option value="week">Hafta</option>
              <option value="month">Ay</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 mt-6 sm:mt-0 xl:col-span-1">
            <input
              type="checkbox"
              checked={filters.paid_only}
              onChange={(e) => setFilters((p) => ({ ...p, paid_only: e.target.checked }))}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Yalnızca ödemesi tamamlanan
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 mt-2 sm:mt-0 xl:col-span-1">
            <input
              type="checkbox"
              checked={filters.exclude_deleted}
              onChange={(e) => setFilters((p) => ({ ...p, exclude_deleted: e.target.checked }))}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            İptal edilenleri hariç tut
          </label>
          <div className="flex items-end xl:col-span-1">
            <button
              type="button"
              onClick={() => fetchAnalytics()}
              disabled={loading}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Yenile
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Rapor hesaplanıyor...</p>
        )}

        {!loading && analytics && (
          <>
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-white/[0.04]">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Toplam ciro</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {currencyTry.format(analytics.summary.revenue_total)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-white/[0.04]">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sipariş adedi</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {analytics.summary.orders_count.toLocaleString("tr-TR")}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-white/[0.04]">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Sipariş başına ortalama
                </p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {currencyTry.format(analytics.summary.avg_order_value)}
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-5 mb-10">
              <div className="lg:col-span-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-4">
                  Ciro (zaman serisi)
                </h2>
                {categories.length > 0 ? (
                  <ReactApexChart options={lineOptions} series={lineSeries} type="area" height={320} />
                ) : (
                  <p className="text-sm text-gray-500 py-16 text-center">
                    Bu aralıkta veri bulunamadı.
                  </p>
                )}
              </div>
              <div className="lg:col-span-2 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-4">
                  Ödeme kanalı dağılımı
                </h2>
                {donutSeries.length > 0 && donutSeries.some((v) => v > 0) ? (
                  <ReactApexChart options={donutOptions} series={donutSeries} type="donut" height={320} />
                ) : (
                  <p className="text-sm text-gray-500 py-16 text-center">Ödeme kırılımı yok.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 overflow-hidden dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02]">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  Özet tablo (dönem bazlı)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-4 py-3">Dönem</th>
                      <th className="px-4 py-3">Sipariş</th>
                      <th className="px-4 py-3">Ciro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.timeseries || []).map((row) => (
                      <tr
                        key={row.period}
                        className="border-b border-gray-50 dark:border-gray-800/80 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {formatBucketLabel(row.period, filters.granularity)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{row.orders_count}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {currencyTry.format(Number(row.revenue))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Kayıtlı sorgular</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Mevcut filtreleri kaydederek hızlı erişim oluşturun. Satırda yükle ile aynı aralığı tekrar
          görürsünüz.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Örn: Bu ay ödenen siparişler"
            maxLength={160}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="button"
            disabled={saving || !saveName.trim()}
            onClick={handleSaveCurrent}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Mevcut filtreleri kaydet"}
          </button>
        </div>

        {savedLoading ? (
          <p className="text-sm text-gray-500">Liste yükleniyor...</p>
        ) : savedList.length === 0 ? (
          <p className="text-sm text-gray-500">Henüz kayıtlı sorgu yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02]">
                  <th className="px-4 py-3">Ad</th>
                  <th className="px-4 py-3">Son güncelleme</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {savedList.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 dark:border-gray-800/80 hover:bg-gray-50/40 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      {renameId === row.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename()}
                            className="text-emerald-600 text-xs font-medium"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenameId(null)}
                            className="text-gray-500 text-xs"
                          >
                            Vazgeç
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startRename(row)}
                          className="text-left font-medium text-gray-800 dark:text-gray-200 hover:text-violet-600 dark:hover:text-violet-400"
                          title="Adı düzenlemek için tıklayın"
                        >
                          {row.name}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(row.updated_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => loadSavedFilters(row)}
                        className="text-violet-600 hover:text-violet-800 dark:text-violet-400 text-xs font-medium mr-3"
                      >
                        Yükle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(row.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs font-medium"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
