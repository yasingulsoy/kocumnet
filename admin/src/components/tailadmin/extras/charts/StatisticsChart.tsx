"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/ecommerce/StatisticsChart.tsx
 * Bağımlılık ve LİSANS: ./ApexChart.tsx başındaki not.
 *
 * İstatistik kartı: başlık + açıklama, sağda dönem sekmeleri (ChartTab
 * görünümü), altında alan grafiği. TailAdmin'deki flatpickr tarih aralığı
 * alınmadı (gerekirse extras/datepicker'ı actions'a koy).
 */
import { useState, type ReactNode } from "react";
import { ChartCard } from "../../charts/ChartCard";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { ApexAreaChart } from "./ApexAreaChart";

export interface StatisticsView {
  key: string;
  label: string;
  categories: string[];
  series: { name: string; data: number[] }[];
}

export interface StatisticsChartProps {
  title: ReactNode;
  description?: ReactNode;
  views: StatisticsView[];
  ariaLabel: string;
  /** Sekme grubunun adı. */
  tabsLabel?: string;
  actions?: ReactNode;
}

export function StatisticsChart({ title, description, views, ariaLabel, tabsLabel = "Dönem", actions }: StatisticsChartProps) {
  const [secili, setSecili] = useState(views[0]?.key ?? "");
  const gorunum = views.find((v) => v.key === secili) ?? views[0];
  return (
    <ChartCard
      title={title}
      description={description}
      actions={
        <>
          {views.length > 1 ? (
            <SegmentedTabs
              label={tabsLabel}
              items={views.map((v) => ({ key: v.key, label: v.label, active: v.key === gorunum?.key, onClick: () => setSecili(v.key) }))}
            />
          ) : null}
          {actions}
        </>
      }
    >
      {gorunum ? <ApexAreaChart categories={gorunum.categories} series={gorunum.series} ariaLabel={`${ariaLabel} (${gorunum.label})`} /> : null}
    </ChartCard>
  );
}
