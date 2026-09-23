import { Skeleton } from "@/components/ui";

/**
 * Panel sayfaları yüklenirken iskelet. Boş beyaz ekran yerine düzenin
 * şekli görünsün — sayfa "donmuş" gibi durmasın.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
