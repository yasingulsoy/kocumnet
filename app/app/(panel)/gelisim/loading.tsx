import { Skeleton } from "@/components/ui";

/**
 * Gelişim iskeleti: başlık, hedef kartı, eğilim grafiği, konu haritası ve
 * test tablosu. Kabuklar kitin kartları (rounded-2xl, gray-200 kenar).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Gelişim yükleniyor">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="space-y-4 md:space-y-6">
        {/* Hedef */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="p-5 sm:p-6">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 sm:px-6">
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>

        {/* Eğilim */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          <Skeleton className="mt-5 h-70 w-full rounded-xl" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12 lg:items-start">
          {/* Konu haritası */}
          <div className="rounded-2xl border border-gray-200 bg-white lg:col-span-5">
            <div className="space-y-2 px-5 py-4 sm:px-6 sm:py-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <div className="space-y-5 border-t border-gray-100 p-4 sm:p-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-2 w-25 rounded-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Testlerin */}
          <div className="rounded-2xl border border-gray-200 bg-white lg:col-span-7">
            <div className="space-y-2 px-5 py-4 sm:px-6 sm:py-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-5 w-11 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
