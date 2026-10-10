import { Skeleton } from "@/components/ui";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Kendi iskeleti olmayan panel sayfaları için genel iskelet: başlık ve kit
 * kartlarının kabukları. Boş beyaz ekran yerine düzenin şekli görünsün —
 * sayfa "donmuş" gibi durmasın. Pano, gelişim, test öncesi ve sonuç
 * ekranlarının kendi iskeletleri var (sayfanın gerçek düzeniyle).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      {/* PageBreadcrumb'ın yeri (kendi mb-6'sı gibi) */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40 sm:h-8" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="space-y-4 md:space-y-6">
        <KartIskeleti satir={3} />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <KartIskeleti satir={2} />
          <KartIskeleti satir={2} />
        </div>
      </div>
    </div>
  );
}

/** ComponentCard'ın kabuğu: başlık şeridi, ince çizgi, gövde satırları. */
function KartIskeleti({ satir }: { satir: number }) {
  return (
    <Card>
      <div className="space-y-2 px-5 py-4 sm:px-6 sm:py-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </div>
      <div className="space-y-3 border-t border-gray-100 p-4 sm:p-6">
        {Array.from({ length: satir }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
