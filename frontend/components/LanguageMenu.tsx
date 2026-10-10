"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { Dropdown, DropdownItem } from "@/components/tailadmin/ui/Dropdown";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { gorunenYol, switchLocalePath } from "@/lib/routes";

/**
 * Marka şeridindeki dil menüsü — kitin açılır menüsü (Dropdown): dışarı
 * tıklayınca, Esc ya da Tab ile dışarı çıkınca kapanır, ↑/↓ öğeler arasında
 * gezer, Esc'te odak düğmeye döner. Klavyeyle açılınca ilk dile odaklanır.
 * Geçerli dil vurgulu ve aria-current; bağlantılar hreflang ve lang taşır.
 */
export function LanguageMenu({ locale, label }: { locale: Locale; label: string }) {
  // Statik üretimde Türkçe sayfanın yolu içeride /tr/…: görünen yola indir.
  const pathname = gorunenYol(usePathname() || "/");
  const [acik, setAcik] = useState(false);
  const [klavyeyle, setKlavyeyle] = useState(false);
  const dugme = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={dugme}
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 transition hover:bg-white/10 hover:text-white"
        aria-expanded={acik}
        aria-controls={acik ? "dil-menusu" : undefined}
        aria-label={`${label}: ${LOCALE_NAMES[locale]}`}
        onClick={(e) => {
          // detail 0: Enter/Boşluk ile açıldı.
          setKlavyeyle(e.detail === 0);
          setAcik((a) => !a);
        }}
      >
        <Globe className="size-3.5" aria-hidden />
        {LOCALE_NAMES[locale]}
        <ChevronDown className={cx("size-3.5 transition-transform", acik && "rotate-180")} aria-hidden />
      </button>
      <Dropdown
        id="dil-menusu"
        isOpen={acik}
        onClose={() => setAcik(false)}
        triggerRef={dugme}
        autoFocus={klavyeyle}
        ariaLabel={label}
        // zemin-acik: koyu şeridin içindeki beyaz panel, odak çerçevesi marka mavisi kalsın.
        className="zemin-acik animate-fade w-44 p-2"
      >
        {LOCALES.map((dil) => (
          <DropdownItem key={dil} tag="a" href={switchLocalePath(pathname, dil)} hrefLang={dil} lang={dil} active={dil === locale}>
            {LOCALE_NAMES[dil]}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
