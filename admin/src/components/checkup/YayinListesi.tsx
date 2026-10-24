import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react";
import type { KontrolMaddesi } from "@/lib/checkup/shared/question-readiness";
import { cx } from "@/components/tailadmin/cx";

/**
 * "Yayına hazır mı" denetim listesi — soru formunda (canlı, sunucu eyleminden)
 * ve inceleme kuyruğunda (sunucuda çizilir) aynı görünüm. Kural
 * shared/question-readiness.ts'te; buradan yalnızca TİP alınır (o modül
 * node:crypto kullanıyor, istemci paketine giremez).
 *
 * Hook yok, "use client" yok: hem sunucu hem istemci bileşeni çizer.
 */
export function YayinListesi({
  maddeler,
  bekleniyor = false,
  className,
}: {
  /** Liste henüz gelmediyse null. */
  maddeler: KontrolMaddesi[] | null;
  /** Yazı değişti, liste yeniden denetleniyor. */
  bekleniyor?: boolean;
  className?: string;
}) {
  const eksik = maddeler?.filter((m) => !m.tamam).length ?? 0;
  return (
    <div className={cx("rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3", className)} aria-live="polite">
      <p className="flex items-center gap-2 text-theme-xs font-semibold text-gray-700">
        Yayına hazır mı?
        {bekleniyor || !maddeler ? (
          <LoaderCircle aria-label="Denetleniyor" className="size-3.5 animate-spin text-gray-400" />
        ) : eksik ? (
          <span className="font-normal text-warning-700">{eksik} eksik</span>
        ) : (
          <span className="font-normal text-success-700">evet</span>
        )}
      </p>
      {maddeler ? (
        <ul className={cx("mt-2 space-y-1.5", bekleniyor && "opacity-60")}>
          {maddeler.map((m) => (
            <li key={m.kod} className="flex gap-2 text-theme-xs">
              {m.ilgisiz ? (
                <CircleDashed aria-hidden className="mt-px size-3.5 shrink-0 text-gray-400" />
              ) : m.tamam ? (
                <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0 text-success-600" />
              ) : (
                <CircleX aria-hidden className="mt-px size-3.5 shrink-0 text-error-600" />
              )}
              <span className={m.ilgisiz ? "text-gray-400" : m.tamam ? "text-gray-600" : "text-gray-800"}>
                <span className="sr-only">{m.ilgisiz ? "Gerekmiyor: " : m.tamam ? "Tamam: " : "Eksik: "}</span>
                {m.tamam ? m.baslik : (m.mesaj ?? m.baslik)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
