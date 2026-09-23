"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { planYenidenUretAction } from "@/lib/actions/plan";
import { Button, Card } from "@/components/ui";

/**
 * Bu haftanın planı yoksa gösterilir.
 *
 * Normalde plan test bitince kendiliğinden oluşuyor. Bu kart iki durum için:
 * (1) hafta değişti, yeni test çözülmedi; (2) bu özellikten önce çözülmüş
 * eski sonuçlar. Her iki durumda da öğrencinin elinde ölçüm var ama plan yok.
 */
export function PlanOlusturKarti() {
  const [pending, start] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-brand">
        <CalendarCheck className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">Bu hafta için planın yok</p>
        <p className="text-caption text-ink-soft">
          {hata ?? "Son check-up'ından iki konuluk bir haftalık plan çıkarabilirim."}
        </p>
      </div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setHata(null);
            const res = await planYenidenUretAction();
            if (!res.ok) setHata(res.error ?? "Plan oluşturulamadı.");
          })
        }
        className="max-sm:w-full"
      >
        {pending ? "Hazırlanıyor…" : "Planı oluştur"}
      </Button>
    </Card>
  );
}
