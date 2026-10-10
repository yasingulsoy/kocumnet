import { Skeleton } from "@/components/ui";

/**
 * Sonuç hesaplanıp çizilirken sonuç ekranının şeklinde iskelet: başlık,
 * özet, puan kartları, koçun cümlesi, bu haftanın konuları. Testi bitiren
 * öğrencinin ilk gördüğü ekran; panonun genel iskeleti burada yanlış bir şey
 * vaat ediyordu. Kabuklar kitin kartları (rounded-2xl, gray-200 kenar).
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Sonucun hazırlanıyor">
      {/* Geri bağlantısı + yazdırma, başlık ve sınav rozeti */}
      <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      <div className="space-y-4 md:space-y-6">
        {/* Özet: gösterge + karar */}
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:gap-6 sm:p-6">
          <Skeleton className="h-15 w-28 shrink-0 rounded-t-full sm:h-24 sm:w-44" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>

        {/* Puan kartları */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 md:p-6">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="mt-2 h-7 w-16 sm:mt-3 sm:h-8" />
            </div>
          ))}
        </div>

        {/* Koçun cümlesi */}
        <div className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Bu hafta sadece bunlar */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="space-y-2 px-5 py-4 sm:px-6 sm:py-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
