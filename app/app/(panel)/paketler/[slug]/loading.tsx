import { Skeleton } from "@/components/ui";

/**
 * Test öncesi ekran iskeleti — sayfanın düzeniyle aynı: başlık (iz, ad,
 * özet), telefonda sayılar, başlat kartı, ayrıntı; masaüstünde başlat
 * kartı sağda.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Test bilgileri yükleniyor" className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-7 w-3/4 max-w-md" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="grid grid-cols-3 gap-4 md:gap-6 lg:col-start-1 lg:row-start-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl lg:col-start-2 lg:row-span-2 lg:row-start-1" />
        <div className="space-y-4 md:space-y-6 lg:col-start-1 lg:row-start-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
