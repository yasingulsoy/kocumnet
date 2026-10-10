"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";
import { localizedPath, type RouteKey } from "@/lib/routes";

/*
 * Dil düzeninin içindeki 404: başlık ve altbilgi dildeki hâliyle kalır
 * (bilinmeyen blog yazısı, silinmiş sayfa, yanlış yazılmış adres).
 * not-found.tsx parametre alamadığı için dil adresten okunur; sözlükler
 * yalnızca sunucuda yüklendiğinden metin burada.
 *
 * Görünüm kitin hata sayfası (ızgara, büyük "404"), site düzeninin içinde
 * (`embedded`). Altında en çok aranan sayfalar.
 */
const METIN = {
  tr: {
    baslik: "Sayfa bulunamadı",
    metin: "Aradığınız sayfa taşınmış, kaldırılmış ya da adres yanlış yazılmış olabilir.",
    ana: "Ana sayfa",
    oneriler: "Belki şunlardan birini arıyordunuz:",
  },
  en: {
    baslik: "Page not found",
    metin: "The page may have moved or been removed, or the address may be mistyped.",
    ana: "Home",
    oneriler: "Maybe you were looking for one of these:",
  },
  ar: {
    baslik: "الصفحة غير موجودة",
    metin: "ربما نُقلت الصفحة أو حُذفت، أو كُتب العنوان بشكل خاطئ.",
    ana: "الرئيسية",
    oneriler: "ربما كنت تبحث عن إحدى هذه الصفحات:",
  },
} as const;

/** Menü adları: sözlükteki nav değerleriyle aynı. */
const SAYFALAR: Record<keyof typeof METIN, Partial<Record<RouteKey, string>>> = {
  tr: { services: "Hizmetlerimiz", products: "Ürünlerimiz", blog: "Blog", contact: "İletişim" },
  en: { services: "Services", products: "Products", blog: "Blog", contact: "Contact" },
  ar: { services: "خدماتنا", products: "المنتجات", blog: "المدوّنة", contact: "اتصل بنا" },
};

export default function NotFound() {
  const pathname = usePathname() ?? "/";
  // "/enerji" gibi Türkçe bir adres İngilizce sayılmasın: önek tam segment olmalı.
  const onek = pathname.split("/")[1];
  const dil = onek === "en" ? "en" : onek === "ar" ? "ar" : "tr";
  const t = METIN[dil];
  const sayfalar = Object.entries(SAYFALAR[dil]) as [RouteKey, string][];

  return (
    <ErrorPage
      embedded
      title={t.baslik}
      message={t.metin}
      actions={
        <ButtonLink href={localizedPath("home", dil)} size="md">
          {t.ana}
        </ButtonLink>
      }
    >
      <nav aria-label={t.oneriler} className="mt-10">
        <p className="text-sm text-gray-500">{t.oneriler}</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {sayfalar.map(([anahtar, ad]) => (
            <li key={anahtar}>
              <Link
                href={localizedPath(anahtar, dil)}
                className="flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-theme-sm font-medium text-gray-700 shadow-theme-xs transition hover:border-gray-300 hover:text-brand-500"
              >
                {ad}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </ErrorPage>
  );
}
