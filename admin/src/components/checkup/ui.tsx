import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { MeterTone } from "@/components/tailadmin/charts/MeterList";
import { cx } from "@/components/tailadmin/cx";
import type { BadgeColor } from "@/components/tailadmin/ui/Badge";
import { TableCell } from "@/components/tailadmin/ui/Table";

/**
 * Check-up paneline özgü yardımcılar. Görsel yapı taşları TailAdmin kitinden
 * (components/tailadmin, kaynak design/tailadmin — elle düzenlenmez); burada
 * yalnızca panele özgü renk eşlemeleri, sorgu dizesi ve kitte karşılığı
 * olmayan küçük parçalar (tek çubuk, hedef çubuğu, sıralanır başlık) kaldı.
 *
 * Hook yok: sunucu ve istemci bileşenleri ikisi de çağırır.
 */

/** Tek aralıklı yazı (kimlik, kod). tokens.css'teki --font-mono. */
export const MONO = "font-mono";

/** Satır içi kod parçası: kazanım kodu, `$…$` yazımı, soru kimliği. */
export const CODE = "rounded bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-700";

// ─── Renk eşlemeleri (rozet) ───────────────────────────────────

export const QUESTION_STATUS_COLOR: Record<string, BadgeColor> = {
  DRAFT: "light",
  REVIEW: "warning",
  PUBLISHED: "success",
  ARCHIVED: "light",
};

/** Paket havuz durumu (pool.ts PackageState) → rozet. */
export const PACKAGE_STATE_COLOR: Record<string, BadgeColor> = { ready: "success", narrow: "warning", blocked: "error" };

/** Bulgu ve risk tonu (item-flags.ts, risk.ts: bad | warn | info) → rozet. */
export const BULGU_COLOR: Record<string, BadgeColor> = { bad: "error", warn: "warning", info: "info" };

/** Konu seviyesi (STRONG/MEDIUM/WEAK) → rozet; seviyesiz gri. */
export function levelColor(level: string | null | undefined): BadgeColor {
  return level === "STRONG" ? "success" : level === "MEDIUM" ? "warning" : level === "WEAK" ? "error" : "light";
}

/** Konu seviyesi → çubuk rengi (MeterList tone). */
export function levelTone(level: string | null | undefined): MeterTone {
  return level === "STRONG" ? "success" : level === "MEDIUM" ? "warning" : level === "WEAK" ? "error" : "gray";
}

// ─── Tek çubuk ─────────────────────────────────────────────────

const DOLGU: Record<MeterTone, string> = {
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  gray: "bg-gray-400",
};

/**
 * İnce oran çubuğu (0-1): MeterList'in çubuğu, tek başına (tablo hücresi,
 * kart). Süs: sayı her zaman yanında yazılır, ekran okuyucu onu okur.
 */
export function Meter({ ratio, tone = "brand", className }: { ratio: number; tone?: MeterTone; className?: string }) {
  const oran = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div aria-hidden className={cx("relative h-2 w-full overflow-hidden rounded-sm bg-gray-200", className)}>
      <div className={cx("absolute inset-y-0 start-0 rounded-sm", DOLGU[tone])} style={{ width: oran * 100 + "%" }} />
    </div>
  );
}

/** "32 / 50" + çubuk. Hazırlık sayaçları için (kazanım, seviye, soru). */
export function ProgressLine({ label, value, target }: { label: ReactNode; value: number; target: number }) {
  const oran = target > 0 ? value / target : 0;
  const tone: MeterTone = value === 0 ? "error" : oran >= 1 ? "success" : "warning";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-theme-xs">
        <span className="truncate text-gray-500">{label}</span>
        <span className="tabular shrink-0 font-semibold text-gray-800">
          {value}
          {/* Hedef aşıldıysa "373 / 25" kesir gibi okunmasın. */}
          <span className="font-normal text-gray-500">{value >= target ? " · hedef " + target : " / " + target}</span>
        </span>
      </div>
      <Meter ratio={oran} tone={tone} />
    </div>
  );
}

// ─── Adres ─────────────────────────────────────────────────────

/** Adres çubuğu için sorgu dizesi — boş değerleri atar. */
export function qs(base: string, params: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? base + "?" + s : base;
}

// ─── Sıralanabilir tablo başlığı ───────────────────────────────

/** Kitin tablo başlığı + sıralama bağlantısı (sunucuda). `aria-sort` yönü söyler. */
export function SortHeader({
  label,
  href,
  active,
  dir,
  align = "start",
  title,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "start" | "end";
  title?: string;
}) {
  return (
    <TableCell
      isHeader
      nowrap
      align={align}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      title={title}
    >
      <Link
        href={href}
        className={cx("inline-flex items-center gap-1 transition hover:text-gray-800 [&_svg]:size-3", active && "text-gray-800")}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp aria-hidden />
          ) : (
            <ArrowDown aria-hidden />
          )
        ) : (
          <ArrowUpDown aria-hidden className="opacity-40" />
        )}
      </Link>
    </TableCell>
  );
}
