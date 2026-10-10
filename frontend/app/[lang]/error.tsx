"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";

const METIN = {
  tr: { baslik: "Bir şeyler ters gitti", metin: "Sayfa yüklenirken beklenmeyen bir hata oldu. Yeniden deneyebilirsiniz.", tekrar: "Tekrar dene", ana: "Ana sayfa" },
  en: { baslik: "Something went wrong", metin: "An unexpected error occurred while loading the page. You can try again.", tekrar: "Try again", ana: "Home" },
  ar: { baslik: "حدث خطأ ما", metin: "حدث خطأ غير متوقع أثناء تحميل الصفحة. يمكنك المحاولة مرة أخرى.", tekrar: "حاول مجدداً", ana: "الرئيسية" },
} as const;

/**
 * Dil düzeninin hata sınırı — kitin hata sayfası, site düzeninin içinde.
 * Hata kodu sayısı yok (istemci hatası da olabilir): yerinde kitin ikon kutusu.
 * Next 16: kurtarma fonksiyonunun adı `retry` (`reset` değil).
 */
export default function HataSayfasi({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname() ?? "/";
  // "/enerji" gibi Türkçe bir adres İngilizce sayılmasın: önek tam segment olmalı.
  const onek = pathname.split("/")[1];
  const dil = onek === "en" ? "en" : onek === "ar" ? "ar" : "tr";
  const t = METIN[dil];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage
      embedded
      code={null}
      top={
        <span className="flex size-16 items-center justify-center rounded-2xl bg-error-50 text-error-600">
          <ServerCrash className="size-8" aria-hidden />
        </span>
      }
      title={t.baslik}
      message={t.metin}
      actions={
        <>
          <Button size="md" onClick={() => retry()} startIcon={<RotateCcw aria-hidden />}>
            {t.tekrar}
          </Button>
          <ButtonLink href={dil === "tr" ? "/" : `/${dil}`} variant="outline" size="md">
            {t.ana}
          </ButtonLink>
        </>
      }
    >
      {error.digest ? <p className="mt-6 font-mono text-theme-xs text-gray-500">{error.digest}</p> : null}
    </ErrorPage>
  );
}
