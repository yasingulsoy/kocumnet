"use client";

import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";

/**
 * Panel sayfalarının hata sınırı: kenar çubuğu yerinde kalır. Next 16:
 * kurtarma fonksiyonu `retry` (segmenti yeniden çizer).
 * Üretimde sunucu hatasının mesajı tarayıcıya gelmez; yalnızca `digest`.
 */
export default function PanelHatasi({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const mesaj = error.digest ? null : error.message;

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-error-50 text-error-600">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Bu sayfa yüklenemedi</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Sunucuya ulaşırken bir sorun oldu; çoğu zaman birkaç saniye içinde geçer. Tekrar deneyin.
      </p>
      {mesaj ? <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{mesaj}</p> : null}
      {error.digest ? (
        <p className="mt-3 text-theme-xs text-gray-500">
          Sorun sürerse teknik ekibe şu kodu iletin: <span className="font-mono text-gray-700">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="xs" onClick={() => retry()} startIcon={<RotateCcw />}>
          Tekrar dene
        </Button>
        <ButtonLink href="/" variant="outline" size="xs">
          Panoya dön
        </ButtonLink>
      </div>
    </div>
  );
}
