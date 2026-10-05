import { Skeleton } from "@/components/ui";

/** Gelişim iskeleti: başlık, hedef kartı, eğilim grafiği, konu haritası ve testler. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Gelişim yükleniyor">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="mt-4 aspect-[34/20] w-full rounded-xl sm:aspect-[64/22]" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
