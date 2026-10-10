"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";

/**
 * Beklenmeyen hata (kitin tam ekran hata sayfası). Next 16'da kurtarma
 * fonksiyonunun adı `retry` (`reset` değil) — segmenti yeniden çekip çizer.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage
      code="500"
      top={
        <Link href="/" aria-label="Ana sayfa">
          <Wordmark />
        </Link>
      }
      title="Bir şeyler ters gitti"
      message="Test cevapların güvende — her işaret anında kaydediliyor. Sayfayı yeniden deneyebilirsin."
      actions={
        <>
          <Button onClick={() => retry()} startIcon={<RotateCcw />}>
            Tekrar dene
          </Button>
          <ButtonLink href="/panel" variant="outline">
            Ana sayfa
          </ButtonLink>
        </>
      }
      footer={error.digest ? <span className="tabular font-mono text-theme-xs">Kod: {error.digest}</span> : undefined}
    />
  );
}
