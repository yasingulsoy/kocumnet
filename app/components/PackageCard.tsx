import Link from "next/link";
import { ChevronRight, Clock, Layers, ListChecks, Lock, Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { examShort } from "@/lib/exams";

export interface PackageCardData {
  slug: string;
  name: string;
  summary: string | null;
  questionCount: number;
  durationMinutes: number;
  examScope: string;
  topicCount: number;
  locked: boolean;
  /** Tanışma testi mi — yeni öğrenciye önerilen kısa ilk adım. */
  isIntro?: boolean;
  /** Bu pakette süresi dolmamış, yarım bir test var mı. */
  inProgress: boolean;
  /** Bu paketi daha önce kaç kez bitirdi. */
  timesTaken?: number;
}

/**
 * Sınav rozeti. Altı sınavı altı ayrı renkle ayırmıyoruz: palette altı marka
 * tonu yok ve uydurmak markayı bozar. Ayrımı ROZETİN METNİ yapıyor; dolu
 * rozet yalnızca "ileri seviye" (AYT) ayrımını taşıyor.
 */
function SinavRozeti({ scope }: { scope: string }) {
  return (
    <Badge size="sm" variant={scope === "AYT" ? "solid" : "light"}>
      {examShort(scope)}
    </Badge>
  );
}

/**
 * Paket kartı (kitin Card'ı). Tıklanınca DOĞRUDAN TEST BAŞLAMAZ — önce
 * ayrıntı ekranı açılır. Eskiden karttaki düğme süreyi hemen başlatıyordu;
 * paketin ne sorduğunu, kaç dakika süreceğini görmeden sayaç işliyordu.
 *
 * Telefonda SATIR, geniş ekranda KART: 12 paketi tek sütunda kart kart
 * kaydırmak 2800 piksel ediyordu, satır düzeninde ~1000.
 */
export function PackageCard({ p }: { p: PackageCardData }) {
  return (
    <Link href={"/paketler/" + p.slug} className="group block h-full rounded-2xl">
      <Card className="flex h-full items-center gap-3 p-4 transition group-hover:border-gray-300 group-hover:shadow-theme-md max-sm:active:bg-gray-50 sm:flex-col sm:items-stretch sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SinavRozeti scope={p.examScope} />
            {p.inProgress ? (
              <Badge size="sm" color="warning" startIcon={<Play aria-hidden />}>
                Devam ediyor
              </Badge>
            ) : p.locked ? (
              <Badge size="sm" color="light" startIcon={<Lock aria-hidden />}>
                Kilitli
              </Badge>
            ) : p.isIntro ? (
              <Badge size="sm" color="success" startIcon={<Sparkles aria-hidden />}>
                Tanışma
              </Badge>
            ) : p.timesTaken ? (
              <span className="text-theme-xs text-gray-500">{p.timesTaken} kez çözdün</span>
            ) : null}
          </div>

          <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-gray-800 max-sm:line-clamp-1 sm:mt-3 sm:text-lg">
            {p.name}
          </h3>

          {/* Telefonda tek satır sayı şeridi; özet yalnızca geniş ekranda. */}
          <p className="tabular mt-1 text-theme-xs text-gray-500 sm:hidden">
            {p.questionCount} soru · {p.durationMinutes} dk · {p.topicCount} konu
          </p>

          {p.summary ? (
            <p className="mt-1.5 line-clamp-2 text-theme-sm leading-relaxed text-gray-500 max-sm:hidden">{p.summary}</p>
          ) : null}
        </div>

        <ChevronRight className="size-5 shrink-0 text-gray-400 sm:hidden rtl:rotate-180" aria-hidden />

        <div className="mt-auto hidden pt-5 sm:block">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-theme-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <ListChecks className="size-4 text-gray-400" aria-hidden />
              <span className="tabular font-medium text-gray-800">{p.questionCount}</span> soru
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-gray-400" aria-hidden />
              <span className="tabular font-medium text-gray-800">{p.durationMinutes}</span> dk
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-4 text-gray-400" aria-hidden />
              <span className="tabular font-medium text-gray-800">{p.topicCount}</span> konu
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3.5">
            <span className="text-theme-sm font-medium text-brand-500">
              {p.inProgress ? "Kaldığın yerden devam et" : p.locked ? "Ayrıntıları gör" : "Teste göz at"}
            </span>
            <ChevronRight className="size-4 text-brand-500 transition group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
          </div>
        </div>
      </Card>
    </Link>
  );
}
