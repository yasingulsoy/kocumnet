import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { durumHaritasi, ilerlemeHesapla } from "@/lib/checkup/hoca/cevap";
import { hocaCevapKayitlari } from "@/lib/checkup/hoca/kayitlar";
import { HOCA_BOLUMLERI } from "@/lib/checkup/hoca/sorular";
import { Meter } from "./ui";

/**
 * Genel bakıştaki küçük kart: "Hocaya sorular: 23/112 cevaplandı · 4 acil
 * bekliyor". Kendi sorgusunu yapan sunucu bileşeni; bütün personele görünür
 * (ekranı herkes okuyabiliyor). Soru yoksa hiçbir şey çizmez.
 */
export async function HocaSorulariKutusu() {
  const i = ilerlemeHesapla(HOCA_BOLUMLERI, durumHaritasi(await hocaCevapKayitlari()));
  if (i.toplam === 0) return null;
  return (
    <Link
      href={i.acilBekleyen > 0 ? "/checkup/hoca?suzgec=acil" : "/checkup/hoca"}
      className="group mb-6 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 transition hover:bg-gray-50 sm:px-6"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-theme-sm font-medium text-gray-800 group-hover:text-brand-500">
          Hocaya sorular: <span className="tabular">{i.cevaplanan}/{i.toplam}</span> cevaplandı
          {i.acilBekleyen > 0 ? (
            <span className="font-semibold text-error-700"> · {i.acilBekleyen} acil bekliyor</span>
          ) : null}
        </span>
        <Meter ratio={i.cevaplanan / i.toplam} tone={i.cevaplanan === i.toplam ? "success" : "brand"} className="mt-2 max-w-md" />
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-400 rtl:rotate-180" />
    </Link>
  );
}
