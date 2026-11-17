import type { ReactNode } from "react";
import Link from "next/link";
import { girisliOgrenci } from "@/lib/backend";
import { UstCubuk } from "@/components/UstCubuk";

/*
 * Girişli sayfalar: panel, sınav seçimi, rapor, profil. Oturum burada
 * sunucuda denetlenir (proxy yalnızca çerez var mı diye bakar): jeton
 * geçersizse girisliOgrenci girişe yönlendirir. Sayfalar backend'e giderken
 * jetonu ayrıca yeniden doğrulatır; düzen tek başına güvenlik sınırı değil.
 */
export default async function UygulamaDuzeni({ children }: { children: ReactNode }) {
  const ogrenci = await girisliOgrenci();

  return (
    <div className="flex min-h-screen flex-col">
      <UstCubuk adSoyad={ogrenci.adSoyad} />
      <main id="icerik" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-caption text-gray-500 sm:px-6">
          <span>© Koçum.Net</span>
          <Link href="/gizlilik" className="hover:text-gray-700 hover:underline">
            Gizlilik ve KVKK
          </Link>
        </div>
      </footer>
    </div>
  );
}
