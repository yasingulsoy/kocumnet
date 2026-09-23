"use client";

import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, LinkButton } from "@/components/ui";

/**
 * Beklenmeyen hata. Next 16'da kurtarma fonksiyonunun adı `retry`
 * (`reset` değil) — segmenti yeniden çekip çizer.
 */
export default function ErrorPage({
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
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-bad-wash text-bad">
        <ServerCrash className="size-7" />
      </span>
      <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-ink">
        Bir şeyler ters gitti
      </h1>
      <p className="mt-2 max-w-sm text-[15px] text-ink-soft">
        Test cevapların güvende — her işaret anında kaydediliyor. Sayfayı yeniden deneyebilirsin.
      </p>
      {error.digest ? (
        <p className="tabular mt-3 font-mono text-xs text-ink-faint">Kod: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex gap-3">
        <Button onClick={() => retry()}>
          <RotateCcw /> Tekrar dene
        </Button>
        <LinkButton href="/panel" variant="secondary">
          Ana sayfa
        </LinkButton>
      </div>
    </main>
  );
}
