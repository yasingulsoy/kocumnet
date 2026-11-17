import { cx } from "@/components/tailadmin/cx";

/**
 * Başarı çubuğu ve yüzdesi. Anlamı yüzde metni taşır; renk yalnızca
 * destek (≥70 yeşil, 40–69 turuncu, <40 kırmızı).
 */
export function BasariCubugu({ yuzde, className }: { yuzde: number; className?: string }) {
  const deger = Math.max(0, Math.min(100, Math.round(yuzde)));
  const ton = deger >= 70 ? "bg-ok-fill" : deger >= 40 ? "bg-warn-fill" : "bg-bad-fill";
  return (
    <div className={cx("basari-cubugu flex items-center gap-2", className)}>
      <div aria-hidden className="h-2 w-full min-w-14 overflow-hidden rounded-full bg-gray-100">
        <div className={cx("h-full rounded-full", ton)} style={{ width: `${deger}%` }} />
      </div>
      <span className="tabular w-11 shrink-0 text-end text-sm font-semibold text-gray-800">%{deger}</span>
    </div>
  );
}
