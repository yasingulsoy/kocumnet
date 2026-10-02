import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

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
        const kilitli = durduguSeviye !== null ? s > durduguSeviye : s > ulasilan;
        const durdu = durduguSeviye === s;

        return (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 ring-1 ring-inset transition",
                gecildi && "bg-ok-wash text-ok ring-ok/20",
                aktif && "bg-brand-wash text-brand ring-brand/25",
                durdu && "bg-bad-wash text-bad ring-bad/20",
                kilitli && !durdu && "bg-surface-sunk text-ink-faint ring-line"
              )}
              aria-current={aktif ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-bold",
                  gecildi && "bg-ok text-white",
                  aktif && "bg-brand text-white",
                  durdu && "bg-bad text-white",
                  kilitli && !durdu && "bg-line-strong text-white"
                )}
              >
                {gecildi ? (
                  <Check className="size-3.5" />
                ) : kilitli && !durdu ? (
                  <Lock className="size-3" />
                ) : (
                  s
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-micro font-semibold leading-tight">Seviye {s}</span>
                <span className="block truncate text-micro leading-tight opacity-70 max-sm:hidden">
                  {adlar[i]}
                </span>
              </span>
            </div>
            {i < 2 ? (
              <span
                aria-hidden
                className={cn("h-px w-2 shrink-0", gecildi ? "bg-ok/40" : "bg-line")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
