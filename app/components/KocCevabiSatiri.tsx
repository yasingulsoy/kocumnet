import { ArrowRight, MessageCircleReply } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Ana sayfa: koçun yazdığı ama öğrencinin henüz görmediği cevaplar.
 * Yoksa hiç çizilmez; "Koça sorularım" açılınca cevaplar okundu sayılır ve
 * kart kendiliğinden söner (lib/koca-soru.ts cevaplariOkundu).
 */
export function KocCevabiSatiri({ adet }: { adet: number }) {
  if (adet <= 0) return null;
  return (
    <Card tone="brand" className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <MessageCircleReply className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold text-gray-800">
          Koçun cevapladı <span className="tabular">({adet})</span>
        </h2>
        <p className="mt-0.5 text-theme-sm text-gray-500">
          {adet === 1 ? "Sorduğun soruya cevap geldi." : `Sorduğun ${adet} soruya cevap geldi.`}
        </p>
      </div>
      <ButtonLink href="/sorularim" endIcon={<ArrowRight className="rtl:rotate-180" />} className="max-sm:w-full">
        Cevabı oku
      </ButtonLink>
    </Card>
  );
}
