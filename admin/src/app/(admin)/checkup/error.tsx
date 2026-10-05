"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Card, MONO, buttonClass } from "@/components/checkup/ui";

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
      <span className="flex size-12 items-center justify-center rounded-xl bg-bad-wash text-bad">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="font-display mt-4 text-h2 font-semibold text-ink">Bu ekran yüklenemedi</h1>
      <p className="mt-2 text-body text-ink-soft">
        Veritabanına ulaşılamamış ya da beklenmeyen bir hata oluşmuş olabilir. Tekrar dene; sorun
        sürerse aşağıdaki kodu teknik ekibe ilet.
      </p>
      {error.digest ? (
        <p className="mt-3 text-micro text-ink-faint">
          Hata kodu: <span className={MONO + " tabular text-ink-soft"}>{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              (retry ?? reset)?.();
            })
          }
          className={buttonClass("primary", "sm")}
        >
          <RotateCcw aria-hidden /> Tekrar dene
        </button>
        <Link href="/checkup" className={buttonClass("outline", "sm")}>
          Genel bakışa dön
        </Link>
      </div>
    </Card>
  );
}
