import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Flame } from "lucide-react";
import type { SeriOzeti } from "@/lib/seri";
import { Progress } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Seri ve günlük hedef kartı (ana sayfa). Hesap lib/seri.ts'te.
 *
 * Üç bilgi, tek kart: kaç gündür çalışıyor, bugünkü hedefin neresinde, son
 * yedi gün. Bugün henüz soru çözmediyse seri kırılmış gösterilmez: "bugün de
 * sürsün" denir — gün bitmeden "serin bitti" demek motivasyonu kırar.
 *
 * `eylem`: kart "bugün bir soru çöz" dediğinde (bugün henüz soru yok) yanında
 * duran düğme; pano seçer (hızlı 5 soru, bugünkü tekrar ya da testler).
 * Eskiden kart çağrıyı yapıp düğme vermiyordu.
 */
export function SeriKarti({ ozet, eylem }: { ozet: SeriOzeti; eylem?: ReactNode }) {
  const { seri, bugunCalisti, seriBekliyor, bugunAdet, hedef, hedefTamam, enUzun, son7 } = ozet;

  const baslik = bugunCalisti
    ? seri >= 2
      ? `${seri} gündür çalışıyorsun`
      : "Serin başladı: bugün 1. gün"
    : seriBekliyor
      ? `${seri} günlük serin var`
      : "Bugün bir soru çöz, serin başlasın";

  const alt = seriBekliyor
    ? "Bugün bir soru çöz, seri bugün de sürsün."
    : enUzun > seri && enUzun >= 2
      ? `Son 90 günde en uzun serin ${enUzun} gün.`
      : bugunCalisti && seri >= 2
        ? "Her gün birkaç soru, yeter."
        : "Her tür test ve alıştırmada çözdüğün sorular sayılır.";

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <span
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            bugunCalisti ? "bg-warning-50 text-warning-600" : "bg-gray-100 text-gray-500"
          )}
        >
          <Flame className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-[1_1_12rem]">
          <h2 className="font-display text-base font-semibold text-balance text-gray-800">{baslik}</h2>
          <p className="mt-0.5 text-theme-sm leading-relaxed text-gray-500">{alt}</p>
        </div>
        {!bugunCalisti && eylem ? <div className="w-full sm:w-auto sm:shrink-0">{eylem}</div> : null}
      </div>

      {/* Bugünkü hedef: hedef 0 ise yalnızca sayı. */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-theme-sm font-medium text-gray-700">
            {hedef > 0 ? (
              <>
                Bugün <span className="tabular font-semibold text-gray-800">{bugunAdet}/{hedef}</span> soru
              </>
            ) : (
              <>
                Bugün <span className="tabular font-semibold text-gray-800">{bugunAdet}</span> soru çözdün
              </>
            )}
          </p>
          {hedefTamam ? (
            <span className="inline-flex items-center gap-1 text-theme-xs font-semibold text-success-700">
              <Check className="size-3.5" aria-hidden /> Hedef tamam
            </span>
          ) : (
            <Link
              href="/profil#gunluk-hedef"
              className="inline-flex min-h-9 items-center text-theme-xs font-medium text-gray-500 transition hover:text-brand-500"
            >
              {hedef > 0 ? "Hedefi değiştir" : "Hedef koy"}
            </Link>
          )}
        </div>
        {hedef > 0 ? (
          <Progress
            value={(bugunAdet / hedef) * 100}
            tone={hedefTamam ? "ok" : "brand"}
            label={`Günlük hedef: ${hedef} sorudan ${bugunAdet}`}
            className="mt-1.5"
          />
        ) : null}
      </div>

      {/* Son yedi gün: bugün en sağda (RTL'de solda). */}
      <ol className="mt-4 flex justify-between gap-1" aria-label="Son 7 gün">
        {son7.map((g) => (
          <li key={g.gun} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="sr-only">
              {g.uzun}
              {g.bugun ? " (bugün)" : ""}: {g.adet > 0 ? `${g.adet} soru` : "çalışılmadı"}
            </span>
            <span
              aria-hidden
              className={cx(
                "flex size-8 items-center justify-center rounded-full text-theme-xs font-semibold sm:size-9",
                g.adet > 0 ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-400",
                g.bugun && "ring-2 ring-brand-500 ring-offset-2 ring-offset-white"
              )}
            >
              {g.adet > 0 ? <Check className="size-4" /> : null}
            </span>
            <span aria-hidden className={cx("text-[11px] font-medium", g.bugun ? "text-gray-800" : "text-gray-500")}>
              {g.kisa}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
