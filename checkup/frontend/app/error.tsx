"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { UygulamaLogosu } from "@/components/Logo";

/*
 * Beklenmeyen hata (çoğunlukla backend'e ulaşılamadı). Next 16'da kurtarma
 * fonksiyonu `retry`: bölümü sunucudan yeniden çekip çizer. Üretimde hata
 * mesajı gizlenir; `digest` sunucu günlüğündeki kayıtla eşleşir.
 */
export default function HataSayfasi({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage
      code={null}
      top={<UygulamaLogosu size="md" />}
      title="Bir şeyler ters gitti"
      message="Sayfayı şu an gösteremiyoruz. Biraz sonra yeniden dene; cevapların kaydedildiyse kaybolmaz."
      actions={
        <>
          <Button size="md" onClick={() => retry()} startIcon={<RotateCcw />}>
            Yeniden dene
          </Button>
          <ButtonLink href="/panel" size="md" variant="outline">
            Panele git
          </ButtonLink>
        </>
      }
      footer={error.digest ? `Hata kodu: ${error.digest}` : undefined}
    />
  );
}
