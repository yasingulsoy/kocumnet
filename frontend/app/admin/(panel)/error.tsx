"use client";

import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";

/**
 * Panel sayfalarının hata sınırı — çerçeve (kenar çubuğu) yerinde kalır.
 * Eskiden yönetimde hata sınırı yoktu: backend bir an düşse Next'in çıplak
 * "Application error" ekranı çıkıyordu. Next 16: kurtarma fonksiyonu `retry`.
 */
export default function PanelHata({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-error-50 text-error-600">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Bu sayfa yüklenemedi</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Sunucuya ulaşırken bir sorun oldu; çoğu zaman birkaç saniye içinde geçer. Kaydedilmemiş bir yazın varsa bu tarayıcıda
        yedeği duruyor, editörü yeniden açınca geri yükleyebilirsin.
      </p>
      {error.digest ? (
        <p className="mt-3 text-theme-xs text-gray-500">
          Sorun sürerse teknik ekibe şu kodu ilet: <span className="font-mono text-gray-700">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="xs" onClick={() => retry()} startIcon={<RotateCcw />}>
          Tekrar dene
        </Button>
        <ButtonLink href="/admin" variant="outline" size="xs">
          Genel bakış
        </ButtonLink>
      </div>
    </div>
  );
}
