import Link from "next/link";
import { LogOut } from "lucide-react";
import { cikisYap } from "@/lib/eylemler/hesap";
import { UygulamaLogosu } from "@/components/Logo";
import { UstCubukBaglantilari } from "./UstCubukBaglantilari";

/**
 * Girişli sayfaların sade üst çubuğu: logo, Panel, Profil, Çıkış.
 * Sınav ekranında (/test) yok: orası dikkat dağıtmayan tam ekran.
 */
export function UstCubuk({ adSoyad }: { adSoyad: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur print:hidden">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/panel" aria-label="Panel" className="flex min-h-11 items-center rounded-lg">
          <UygulamaLogosu />
        </Link>
        <nav aria-label="Ana menü" className="ms-auto flex items-center gap-1">
          <UstCubukBaglantilari />
          <form action={cikisYap}>
            <button
              type="submit"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-800"
              title={`${adSoyad} hesabından çık`}
            >
              <LogOut className="size-5 sm:size-4" aria-hidden />
              <span className="max-sm:sr-only">Çıkış</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
