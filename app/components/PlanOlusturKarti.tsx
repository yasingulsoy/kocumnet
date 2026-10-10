"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CircleCheck } from "lucide-react";
import { planYenidenUretAction } from "@/lib/actions/plan";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Bu haftanın planı yoksa gösterilir.
 *
 * Normalde plan test bitince kendiliğinden oluşuyor. Bu kart iki durum için:
 * (1) hafta değişti, yeni test çözülmedi; (2) bu özellikten önce çözülmüş
 * eski sonuçlar. Her iki durumda da öğrencinin elinde ölçüm var ama plan yok.
 *
 * Son check-up'ta kanıtlı zayıf konu yoksa plan da yoktur — bu bir hata
 * değil. Eskiden kart "Kanıtlı zayıf konu bulunamadı." yazıp aynı düğmeyi
 * gösteriyordu; öğrenci tekrar basıp aynı yanıtı alıyordu.
 */
export function PlanOlusturKarti() {
  const [pending, start] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [gerekYok, setGerekYok] = useState(false);

  if (gerekYok) {
    return (
      <Card role="status" className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600">
          <CircleCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-gray-800">Bu hafta plana gerek yok</p>
          <p className="mt-0.5 text-theme-sm text-gray-500">
            Son check-up&apos;ında kanıtlı zayıf konu çıkmadı. Seviyeni daha geniş bir paketle ölç.
          </p>
        </div>
        <ButtonLink href="/paketler" variant="outline" className="max-sm:w-full">
          Testlere göz at
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <CalendarCheck className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold text-gray-800">Bu hafta için planın yok</p>
        <p
          className={hata ? "mt-0.5 text-theme-sm font-medium text-error-600" : "mt-0.5 text-theme-sm text-gray-500"}
          role={hata ? "alert" : undefined}
        >
          {hata ?? "Son check-up'ından iki konuluk bir haftalık plan çıkarabilirim."}
        </p>
      </div>
      <Button
        variant="outline"
        loading={pending}
        startIcon={<CalendarCheck />}
        onClick={() =>
          start(async () => {
            setHata(null);
            const res = await planYenidenUretAction();
            if (res.ok) return;
            if (res.kod === "ZAYIF_YOK") setGerekYok(true);
            else setHata(res.error ?? "Plan oluşturulamadı.");
          })
        }
        className="max-sm:w-full"
      >
        {pending ? "Hazırlanıyor…" : "Planı oluştur"}
      </Button>
    </Card>
  );
}
