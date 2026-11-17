/*
 * Uyarlama: TailAdmin Free (MIT) — components/common/ChartTab.tsx
 *
 * Gri zeminde, seçili olanı beyaz parça. TailAdmin'de üç sabit düğmeydi;
 * burada öğe listesi: `href` verilen öğe bağlantı (süzgeç sekmeleri, adres
 * çubuğunda), verilmeyen düğme (onClick). Yanında sayı gösterilebilir.
 * Dar ekranda yatay kayar. `size="md"`: dokunmatik için büyük parçalar
 * (en az 40px; öğrenci uygulamasındaki sınav rayı). Bağlantılı öğeler bir
 * `<nav>`; yalnızca düğme varsa (sayfa içi geçiş) `role="group"` — gezinme değil.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../cx";

export interface SegmentedTabItem {
  key: string;
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** Etiketin yanında küçük sayı (null/undefined: gösterilmez). */
  count?: number | null;
}

export interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  /** Ekran okuyucu için grubun adı. */
  label: string;
  /** sm (32px, TailAdmin) | md (40px, telefonda parmakla seçilen süzgeç). */
  size?: "sm" | "md";
  className?: string;
}

const PARCA = "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition";
const BOYUT = { sm: "px-3 py-1.5 text-theme-sm", md: "min-h-10 px-3.5 py-2 text-sm" } as const;

export function SegmentedTabs({ items, label, size = "sm", className }: SegmentedTabsProps) {
  const gezinme = items.some((o) => o.href);
  const Kap = gezinme ? "nav" : "div";
  return (
    <Kap aria-label={label} role={gezinme ? undefined : "group"} className={cx("no-scrollbar flex max-w-full overflow-x-auto", className)}>
      <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
        {items.map((o) => {
          const sinif = cx(PARCA, BOYUT[size], o.active ? "bg-white text-gray-900 shadow-theme-xs" : "text-gray-500 hover:text-gray-900");
          const icerik = (
            <>
              {o.label}
              {o.count !== null && o.count !== undefined ? (
                <span className={cx("tabular text-theme-xs", o.active ? "text-brand-500" : "text-gray-500")}>{o.count}</span>
              ) : null}
            </>
          );
          return o.href ? (
            <Link key={o.key} href={o.href} aria-current={o.active ? "page" : undefined} className={sinif}>
              {icerik}
            </Link>
          ) : (
            <button key={o.key} type="button" onClick={o.onClick} aria-pressed={o.active} className={sinif}>
              {icerik}
            </button>
          );
        })}
      </div>
    </Kap>
  );
}
