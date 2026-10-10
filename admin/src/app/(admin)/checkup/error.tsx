"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { MONO } from "@/components/checkup/ui";

/**
 * Check-up ekranlarında beklenmeyen hata (veritabanına ulaşılamadı, bozuk
 * kayıt…). Panel çerçevesi yerinde kalır; eskiden Next'in çıplak hata
 * sayfası çıkıyordu ve kenar çubuğu da gidiyordu.
 *
 * Kurtarma fonksiyonunun adı sürüme göre değişiyor: bu projedeki Next 16.0
 * `reset` veriyor, 16.3+ `retry`. İkisini de kabul ediyoruz; önce sunucu
 * verisini tazeliyoruz, yoksa `reset` aynı hatalı veriyle yeniden çizer.
 */
export default function CheckupError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-6 max-w-xl p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-error-50 text-error-600">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Bu ekran yüklenemedi</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Veritabanına ulaşılamamış ya da beklenmeyen bir hata oluşmuş olabilir. Tekrar dene; sorun
        sürerse aşağıdaki kodu teknik ekibe ilet.
      </p>
      {error.digest ? (
        <p className="mt-3 text-theme-xs text-gray-500">
          Hata kodu: <span className={MONO + " tabular text-gray-700"}>{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          size="xs"
          startIcon={<RotateCcw />}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              (retry ?? reset)?.();
            })
          }
        >
          Tekrar dene
        </Button>
        <ButtonLink href="/checkup" variant="outline" size="xs">
          Genel bakışa dön
        </ButtonLink>
      </div>
    </Card>
  );
}
