import { Skeleton } from "@/components/ui";

/**
 * Sonuç hesaplanıp çizilirken sonuç ekranının şeklinde iskelet: özet, koçun
 * cümlesi, bu haftanın konuları. Testi bitiren öğrencinin ilk gördüğü ekran;
 * panonun genel iskeleti burada yanlış bir şey vaat ediyordu.
 */
export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Sonucun hazırlanıyor">
      <Skeleton className="h-5 w-24" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center gap-4 p-4 sm:p-8">
          <Skeleton className="size-28 shrink-0 rounded-full sm:size-40" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <div className="border-t border-line bg-surface-sunk px-4 py-3 sm:px-8">
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}
