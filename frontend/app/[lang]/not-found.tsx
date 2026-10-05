"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { Container, buttonClass } from "@/components/ui";
import { localizedPath, type RouteKey } from "@/lib/routes";

/*
 * Dil düzeninin içindeki 404: başlık ve altbilgi dildeki hâliyle kalır
 * (bilinmeyen blog yazısı, silinmiş sayfa, yanlış yazılmış adres).
 * not-found.tsx parametre alamadığı için dil adresten okunur; sözlükler
 * yalnızca sunucuda yüklendiğinden metin burada.
 *
 * Eskiden her 404'te "aradığın YAZI silinmiş olabilir" yazıyordu ve yalnızca
 * ana sayfa ile bloga dönülebiliyordu. Artık en çok aranan sayfalar da var.
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
    <main className="flex flex-1 flex-col">
      <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-wash text-brand">
          <Compass className="size-7" aria-hidden />
        </span>
        <p className="font-display mt-6 text-caption font-semibold uppercase tracking-[0.18em] text-brand">404</p>
        <h1 className="font-display mt-2 text-h2 font-semibold tracking-tight text-ink">{t.baslik}</h1>
        <p className="mt-3 max-w-md text-body text-ink-soft">{t.metin}</p>
        <Link href={localizedPath("home", dil)} className={`${buttonClass({ size: "md" })} mt-8`}>
          {t.ana}
        </Link>

        <nav aria-label={t.oneriler} className="mt-10">
          <p className="text-caption text-ink-faint">{t.oneriler}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {sayfalar.map(([anahtar, ad]) => (
              <li key={anahtar}>
                <Link
                  href={localizedPath(anahtar, dil)}
                  className="flex min-h-10 items-center rounded-full bg-surface px-4 text-caption font-medium text-ink-soft ring-1 ring-inset ring-line transition hover:text-brand hover:ring-brand/30"
                >
                  {ad}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </main>
  );
}
