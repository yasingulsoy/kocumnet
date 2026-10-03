"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { Container, buttonClass } from "@/components/ui";

/*
 * Dil düzeninin içindeki 404: başlık ve altbilgi dildeki hâliyle kalır
 * (bilinmeyen blog yazısı, silinmiş sayfa). not-found.tsx parametre alamadığı
 * için dil adresten okunur.
 */
const METIN = {
  tr: { baslik: "Sayfa bulunamadı", metin: "Aradığın yazı silinmiş ya da adres değişmiş olabilir.", ana: "Ana sayfa", blog: "Blog" },
  en: { baslik: "Page not found", metin: "The post may have been removed or the address may have changed.", ana: "Home", blog: "Blog" },
  ar: { baslik: "الصفحة غير موجودة", metin: "ربما حُذفت المقالة أو تغيّر العنوان.", ana: "الرئيسية", blog: "المدونة" },
} as const;

export default function NotFound() {
  const pathname = usePathname() ?? "/";
  const dil = pathname.startsWith("/en") ? "en" : pathname.startsWith("/ar") ? "ar" : "tr";
  const t = METIN[dil];
  const kok = dil === "tr" ? "" : `/${dil}`;

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-wash text-brand">
        <Compass className="size-7" />
      </span>
      <p className="font-display mt-6 text-caption font-semibold uppercase tracking-[0.18em] text-brand">404</p>
      <h1 className="font-display mt-2 text-h2 font-semibold tracking-tight text-ink">{t.baslik}</h1>
      <p className="mt-3 max-w-md text-body text-ink-soft">{t.metin}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={kok || "/"} className={buttonClass({ size: "md" })}>
          {t.ana}
        </Link>
        <Link href={`${kok}/blog`} className={buttonClass({ variant: "secondary", size: "md" })}>
          {t.blog}
        </Link>
      </div>
    </Container>
  );
}
