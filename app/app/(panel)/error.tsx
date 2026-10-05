"use client";

import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, LinkButton } from "@/components/ui";

/**
 * Panel sayfalarındaki beklenmeyen hata.
 *
 * Bu dosya yokken hatayı kök error.tsx yakalıyordu: kenar çubuğu ve alt menü
 * dahil bütün çerçeve sökülüyor, öğrenci boş bir sayfada kalıyordu. Burada
 * hata yalnızca içerik alanında; menü yerinde, başka bir sayfaya tek dokunuş.
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
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center px-2 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-bad-wash text-bad">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="font-display mt-5 text-h2 font-bold tracking-tight text-ink">
        Bu sayfa açılamadı
      </h1>
      <p className="mt-2 max-w-sm text-body text-ink-soft">
        Bağlantı kopmuş ya da bizde bir sorun çıkmış olabilir. Cevapların ve sonuçların güvende.
      </p>
      {error.digest ? (
        <p className="tabular mt-3 font-mono text-micro text-ink-faint">Kod: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>
          <RotateCcw /> Tekrar dene
        </Button>
        <LinkButton href="/panel" variant="secondary">
          Ana sayfa
        </LinkButton>
      </div>
    </div>
  );
}
