"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { WandSparkles } from "lucide-react";
import { applySuggestedDifficultyAction } from "@/lib/checkup/actions/questions";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";

/**
 * Madde analizindeki "zorluk etiketi uymuyor" sorularına önerilen zorluğu
 * uygular. Onay penceresi değişimi özetler ("3 → 1: 7 soru"); sunucu analizi
 * aynı kapsamla yeniden hesaplar, buradaki değerlere güvenmez.
 */
export function ApplyDifficultyButton({
  degisimler,
  sinav,
  gun,
}: {
  degisimler: { id: string; from: number; to: number }[];
  sinav: string;
  gun: number | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const onayla = useOnay();

  const ozet = new Map<string, number>();
  for (const d of degisimler) {
    const k = d.from + " → " + d.to;
    ozet.set(k, (ozet.get(k) ?? 0) + 1);
  }
  const satirlar = [...ozet.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Button
      variant="outline"
      size="xs"
      loading={pending}
      startIcon={<WandSparkles />}
      onClick={async () => {
        const evet = await onayla({
          title: degisimler.length + " sorunun zorluk etiketi değişsin mi?",
          description: (
            <>
              Gözlenen doğru oranına göre:
              {satirlar.map(([k, n]) => (
                <span key={k} className="tabular block font-medium text-gray-700">
                  zorluk {k}: {n} soru
                </span>
              ))}
              <span className="mt-2 block">Seçim kolay/orta/zor bantlarını yeni etikete göre dolduracak.</span>
            </>
          ),
          confirmLabel: "Önerilen zorluğu uygula",
        });
        if (!evet) return;
        start(async () => {
          const r = await applySuggestedDifficultyAction(
            degisimler.map((d) => d.id),
            { sinav, gun }
          );
          if (!r.ok) {
            toast.error(r.error ?? "Uygulanamadı.");
            return;
          }
          toast.success(r.count ? r.count + " sorunun zorluğu güncellendi." : "Değişecek soru kalmamış.");
          router.refresh();
        });
      }}
    >
      Önerilen zorluğu uygula
    </Button>
  );
}
