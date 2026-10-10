"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { planIsiAction } from "@/lib/actions/plan";
import { Button } from "@/components/tailadmin/ui/Button";

/**
 * "Bugün" kartındaki plan işi: "Yaptım" işi kapatır. Eylem panoyu tazeler;
 * kart sıradaki işe geçer, plan kartı da aynı işi işaretli gösterir. Kontrol
 * testi (RETEST) buradan kapanmaz — onun düğmesi testi açar.
 */
export function PlanIsiBitirButonu({ itemId, title }: { itemId: string; title: string }) {
  const [pending, start] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        block
        loading={pending}
        startIcon={<Check />}
        aria-label={`${title}: yaptım, işaretle`}
        onClick={() =>
          start(async () => {
            setHata(null);
            try {
              const res = await planIsiAction(itemId, true);
              if (!res.ok) setHata(res.error ?? "İşaretlenemedi.");
            } catch {
              setHata("Bağlantı koptu, işaretlenemedi. Tekrar dene.");
            }
          })
        }
      >
        {pending ? "İşaretleniyor…" : "Yaptım"}
      </Button>
      {hata ? (
        <p role="alert" className="text-theme-xs font-medium text-error-600">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
