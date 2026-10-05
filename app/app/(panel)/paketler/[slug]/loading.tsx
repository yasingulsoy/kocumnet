import { Skeleton } from "@/components/ui";

/**
 * Test öncesi ekran iskeleti — sayfanın düzeniyle aynı: telefonda özet,
 * başlat kartı, ayrıntı; masaüstünde başlat kartı sağda.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Test bilgileri yükleniyor">
      <Skeleton className="h-4 w-20" />
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-44 rounded-2xl lg:col-start-2 lg:row-span-2 lg:row-start-1" />
        <Skeleton className="h-72 rounded-2xl lg:col-start-1 lg:row-start-2" />
      </div>
    </div>
  );
}
