import { Skeleton } from "@/components/ui";

/**
 * Sınav ekranı hazırlanırken (sorular ve formüller sunucuda çiziliyor)
 * çerçevesiz bir iskelet. Bu dosya yokken "Devam et"e dokunan öğrenci, ekran
 * hazırlanana kadar hiçbir tepki görmüyordu.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-canvas" aria-busy="true" aria-label="Test hazırlanıyor">
      <div className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:h-16 sm:px-6">
          <Skeleton className="size-9 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-5 sm:px-6 sm:pt-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-8">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <div className="mt-5 space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="mt-6 space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-80 rounded-2xl lg:block" />
      </div>
    </main>
  );
}
