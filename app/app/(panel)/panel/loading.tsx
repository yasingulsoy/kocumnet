import { Skeleton } from "@/components/ui";

/**
 * Pano iskeleti: selam satırı, haftanın planı, tek eylem kartı, sayı kartları
 * ve grafikler — sayfanın gerçek sırasıyla (kitin kart kabukları). Yükleme
 * bitince her şey yer değiştirmesin.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Ana sayfa yükleniyor">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-4 md:space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="space-y-3 border-t border-gray-100 px-5 py-4 sm:px-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
          <Skeleton className="h-72 rounded-2xl xl:col-span-4" />
          <Skeleton className="h-72 rounded-2xl xl:col-span-8" />
        </div>
      </div>
    </div>
  );
}
