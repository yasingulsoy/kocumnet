import { Check, Lock } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";

type Durum = "gecildi" | "aktif" | "durdu" | "kilitli";

/*
 * Kit renkleri: geçildi yeşil, sıradaki marka mavisi, durulan kırmızı,
 * kilitli gri. Kutu başına TEK durum seçiliyor: kitin cx'i çakışan
 * sınıfları çözmüyor, iki durumun sınıfı yan yana gelmesin.
 */
const TON: Record<Durum, { kutu: string; nokta: string }> = {
  gecildi: { kutu: "border-success-200 bg-success-50 text-success-700", nokta: "bg-success-600 text-white" },
  aktif: { kutu: "border-brand-200 bg-brand-50 text-brand-500", nokta: "bg-brand-500 text-white" },
  durdu: { kutu: "border-error-200 bg-error-50 text-error-700", nokta: "bg-error-600 text-white" },
  kilitli: { kutu: "border-gray-200 bg-gray-50 text-gray-500", nokta: "bg-gray-200 text-gray-500" },
};

/**
 * Üç seviyelik ilerleme şeridi.
 *
 * Öğrencinin nerede olduğunu tek bakışta göstermesi gerekiyor: hangi
 * seviyeyi geçti, nerede durdu, ne kilitli. Durdurulmuş bir denemede
 * kilidin GÖRÜNÜR olması önemli — "neden devam edemiyorum" sorusunun
 * cevabı ekranda durmalı.
 */
export function SeviyeSeridi({
  ulasilan,
  durduguSeviye,
  bitti,
}: {
  /** Açılmış en yüksek seviye. */
  ulasilan: number;
  /** Durduysa hangi seviyede. */
  durduguSeviye: number | null;
  bitti: boolean;
}) {
  const adlar = ["Temel", "Çok adımlı", "Analiz"];

  return (
    <ol className="flex items-center gap-1.5" aria-label="Seviye ilerlemesi">
      {[1, 2, 3].map((s, i) => {
        const gecildi = bitti ? true : s < ulasilan;
        const aktif = !bitti && s === ulasilan && durduguSeviye === null;
        const durdu = durduguSeviye === s;
        const durum: Durum = durdu ? "durdu" : gecildi ? "gecildi" : aktif ? "aktif" : "kilitli";
        const ton = TON[durum];

        return (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <div
              className={cx("flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 transition", ton.kutu)}
              aria-current={aktif ? "step" : undefined}
            >
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                  ton.nokta
                )}
              >
                {durum === "gecildi" ? (
                  <Check className="size-3.5" aria-hidden />
                ) : durum === "kilitli" ? (
                  <Lock className="size-3" aria-hidden />
                ) : (
                  s
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-theme-xs font-semibold leading-tight">Seviye {s}</span>
                <span className="block truncate text-theme-xs leading-tight max-sm:hidden">{adlar[i]}</span>
              </span>
            </div>
            {i < 2 ? (
              <span
                aria-hidden
                className={cx("h-px w-2 shrink-0", durum === "gecildi" ? "bg-success-300" : "bg-gray-200")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
