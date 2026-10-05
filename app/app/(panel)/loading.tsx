import { Skeleton } from "@/components/ui";

/**
 * Kendi iskeleti olmayan panel sayfaları için genel iskelet: başlık ve iki
 * kart. Boş beyaz ekran yerine düzenin şekli görünsün — sayfa "donmuş" gibi
 * durmasın. Pano, gelişim, test öncesi ve sonuç ekranlarının kendi
 * iskeletleri var (sayfanın gerçek düzeniyle).
 */
export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
