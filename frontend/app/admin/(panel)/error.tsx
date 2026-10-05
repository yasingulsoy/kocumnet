"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, Card, buttonClass } from "@/components/admin/ui";

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
    <Card className="mx-auto mt-6 max-w-xl p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-bad-wash text-bad">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="font-display mt-4 text-h3 font-semibold text-ink">Bu sayfa yüklenemedi</h1>
      <p className="mt-2 text-caption leading-relaxed text-ink-soft">
        Sunucuya ulaşırken bir sorun oldu; çoğu zaman birkaç saniye içinde geçer. Kaydedilmemiş bir yazın varsa bu
        tarayıcıda yedeği duruyor, editörü yeniden açınca geri yükleyebilirsin.
      </p>
      {error.digest ? (
        <p className="mt-3 text-micro text-ink-faint">
          Sorun sürerse teknik ekibe şu kodu ilet: <span className="font-mono text-ink-soft">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => retry()}>
          <RotateCcw /> Tekrar dene
        </Button>
        <Link href="/admin" className={buttonClass({ variant: "secondary", size: "sm" })}>
          Genel bakış
        </Link>
      </div>
    </Card>
  );
}
