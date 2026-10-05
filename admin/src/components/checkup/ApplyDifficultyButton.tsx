"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, WandSparkles } from "lucide-react";
import { applySuggestedDifficultyAction } from "@/lib/checkup/actions/questions";
import { buttonClass } from "./ui";

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

  const ozet = new Map<string, number>();
  for (const d of degisimler) {
    const k = d.from + " → " + d.to;
    ozet.set(k, (ozet.get(k) ?? 0) + 1);
  }
  const satirlar = [...ozet.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => "  zorluk " + k + ": " + n + " soru");

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const onay =
          degisimler.length +
          " sorunun zorluk etiketi gözlenen doğru oranına göre değişecek:\n\n" +
          satirlar.join("\n") +
          "\n\nSeçim kolay/orta/zor bantlarını yeni etikete göre dolduracak. Devam edilsin mi?";
        if (!window.confirm(onay)) return;
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
      className={buttonClass("outline", "sm")}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <WandSparkles aria-hidden />}
      Önerilen zorluğu uygula
    </button>
  );
}
