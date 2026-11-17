"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";

const BAGLANTILAR = [
  // Panel; sınav seçimi ve rapor da panelin altında sayılır.
  { href: "/panel", etiket: "Panel", Ikon: LayoutDashboard, eslesen: ["/panel", "/sinav-sec", "/rapor"] },
  { href: "/profil", etiket: "Profil", Ikon: UserRound, eslesen: ["/profil"] },
];

/** Üst çubuğun menü bağlantıları; bulunulan sayfa aria-current ve alt çizgiyle belli. */
export function UstCubukBaglantilari() {
  const yol = usePathname();
  return (
    <>
      {BAGLANTILAR.map(({ href, etiket, Ikon, eslesen }) => {
        const etkin = eslesen.some((e) => yol === e || yol.startsWith(`${e}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={etkin ? "page" : undefined}
            className={cx(
              "relative flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
              etkin ? "text-brand-600" : "text-gray-600 hover:bg-gray-100 hover:text-gray-800",
              // Etkin bağlantı yalnızca renkle değil, alt çizgiyle de belli.
              etkin && "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-brand-500"
            )}
          >
            <Ikon className="size-5 sm:size-4" aria-hidden />
            <span className="max-sm:sr-only">{etiket}</span>
          </Link>
        );
      })}
    </>
  );
}
