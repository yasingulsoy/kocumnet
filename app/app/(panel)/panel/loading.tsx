import { Skeleton } from "@/components/ui";

/**
 * Pano iskeleti: selam satırı, haftanın planı, tek eylem kartı, ilerleme
 * şeridi — sayfanın gerçek sırasıyla. Genel panel iskeleti dört sayı kartı
 * gösteriyordu; panoda öyle bir bölüm yok, yükleme bitince her şey yer
 * değiştiriyordu.
 */
export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Ana sayfa yükleniyor">
      <Skeleton className="h-4 w-44" />
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="mt-4 h-12 w-full" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}
