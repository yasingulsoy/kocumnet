import { BookMarked, ChevronDown } from "lucide-react";
import type { QuestionContent } from "@/lib/question-content";
import { MathContent } from "@/components/MathContent";
import { cx } from "@/components/tailadmin/cx";

/**
 * Kazanım özet kartı: kazanımın adı ve 3-5 satırlık özeti (formüller dahil).
 *
 * SUNUCU bileşeni (MathContent; KaTeX tarayıcıya inmez). İstemci
 * bileşenlerine (alıştırma ekranı) hazır düğüm olarak verilir.
 *
 * `acilir`: <details> içinde, başlığa dokununca açılır (defterde konu
 * grubunun yanında; ekranı uzatmasın). JS gerektirmez. Özeti olmayan
 * kazanımda kart HİÇ çizilmez: çağıran özet yoksa bileşeni koymaz.
 */
export function KazanimKarti({
  ad,
  ozet,
  acilir = false,
  acik = false,
  className,
}: {
  ad: string;
  ozet: QuestionContent;
  acilir?: boolean;
  /** Açılır kartta başlangıçta açık mı. */
  acik?: boolean;
  className?: string;
}) {
  const baslik = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        <BookMarked className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-theme-xs font-semibold tracking-wide text-brand-500 uppercase">Kazanım özeti</span>
        <span className="block text-theme-sm font-semibold break-words text-gray-800">{ad}</span>
      </span>
    </>
  );
  const govde = (
    <div className="okuma text-body leading-relaxed text-gray-800">
      <MathContent content={ozet} />
    </div>
  );

  if (acilir) {
    return (
      <details open={acik} className={cx("group rounded-xl border border-brand-100 bg-white", className)}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 transition hover:bg-brand-25 [&::-webkit-details-marker]:hidden">
          {baslik}
          <ChevronDown className="size-4 shrink-0 text-gray-400 transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-brand-100 px-3.5 py-3">{govde}</div>
      </details>
    );
  }

  return (
    <section className={cx("rounded-xl border border-brand-100 bg-white", className)} aria-label={`Kazanım özeti: ${ad}`}>
      <div className="flex items-center gap-3 px-3.5 pt-3">{baslik}</div>
      <div className="px-3.5 pt-2 pb-3.5">{govde}</div>
    </section>
  );
}
