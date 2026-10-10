"use client";

import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Panel sayfalarındaki beklenmeyen hata.
 *
 * Bu dosya yokken hatayı kök error.tsx yakalıyordu: kenar çubuğu ve alt menü
 * dahil bütün çerçeve sökülüyor, öğrenci boş bir sayfada kalıyordu. Burada
 * hata yalnızca içerik alanında, kitin kartında (tam ekran ErrorPage değil);
 * menü yerinde, başka bir sayfaya tek dokunuş.
 * Next 16'da kurtarma fonksiyonunun adı `retry` (`reset` değil).
 */
export default function PanelError({
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
    <Card role="alert">
      {/* EmptyState düzeni; başlık h1: sayfanın kendi başlığı çizilemedi. */}
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-error-50 text-error-600">
          <ServerCrash className="size-6" aria-hidden />
        </span>
        <h1 className="font-display text-lg font-semibold text-gray-800">Bu sayfa açılamadı</h1>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          Bağlantı kopmuş ya da bizde bir sorun çıkmış olabilir. Cevapların ve sonuçların güvende.
        </p>
        {error.digest ? (
          <p className="tabular mt-3 font-mono text-theme-xs text-gray-500">Kod: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => retry()} startIcon={<RotateCcw />}>
            Tekrar dene
          </Button>
          <ButtonLink href="/panel" variant="outline">
            Ana sayfa
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}
