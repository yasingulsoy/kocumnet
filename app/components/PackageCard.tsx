import Link from "next/link";
import { ChevronRight, Clock, Layers, ListChecks, Lock, Play, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { examShort } from "@/lib/exams";
import { cn } from "@/lib/cn";

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
 * Sınav rozetinin tonu.
 *
 * Altı sınavı altı ayrı renkle ayırmıyoruz: palette altı marka tonu yok ve
 * uydurmak markayı bozar. Ayrımı ROZETİN METNİ yapıyor; renk yalnızca
 * "temel seviye / ileri seviye" ayrımını taşıyor.
 */
function tone(scope: string): "brand" | "dark" {
  return scope === "AYT" ? "dark" : "brand";
}

/**
 * Paket kartı. Tıklanınca DOĞRUDAN TEST BAŞLAMAZ — önce ayrıntı ekranı
 * açılır. Eskiden karttaki düğme süreyi hemen başlatıyordu; paketin ne
 * sorduğunu, kaç dakika süreceğini görmeden sayaç işlemeye başlıyordu.
 *
 * Telefonda SATIR, masaüstünde KART: 12 paketi tek sütunda kart kart
 * kaydırmak 2800 piksel ediyordu, satır düzeninde ~1000.
 */
export function PackageCard({ p }: { p: PackageCardData }) {
  const koyu = tone(p.examScope) === "dark";

  return (
    <Link href={"/paketler/" + p.slug} className="group block h-full">
      <Card
        interactive
        className={cn(
          "relative h-full overflow-hidden",
          "flex items-center gap-3 p-3 max-sm:active:bg-surface-sunk",
          "sm:flex-col sm:items-stretch sm:p-5"
        )}
      >
        {/* Sınav şeridi: telefonda solda dikey, masaüstünde üstte yatay. */}
        <span
          aria-hidden
          className={cn(
            "absolute max-sm:inset-y-0 max-sm:left-0 max-sm:w-1 sm:inset-x-0 sm:top-0 sm:h-1",
            koyu ? "bg-brand-deep" : "bg-brand-gradient"
          )}
        />

        <div className="min-w-0 flex-1 max-sm:ps-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={tone(p.examScope)}>{examShort(p.examScope)}</Badge>
            {p.inProgress ? (
              <Badge tone="warn">
                <Play /> Devam ediyor
              </Badge>
            ) : p.locked ? (
              <Badge tone="neutral">
                <Lock /> Kilitli
              </Badge>
            ) : p.isIntro ? (
              <Badge tone="ok">
                <Sparkles /> Tanışma
              </Badge>
            ) : p.timesTaken ? (
              <span className="text-micro font-medium text-ink-faint">
                {p.timesTaken} kez çözdün
              </span>
            ) : null}
          </div>

          <h3 className="font-display mt-1.5 text-body font-semibold leading-snug text-ink max-sm:line-clamp-1 sm:mt-3.5 sm:text-[17px]">
            {p.name}
          </h3>

          {/* Telefonda tek satır sayı şeridi; özet yalnızca geniş ekranda. */}
          <p className="mt-1 text-micro tabular text-ink-faint sm:hidden">
            {p.questionCount} soru · {p.durationMinutes} dk · {p.topicCount} konu
          </p>

          {p.summary ? (
            <p className="mt-1.5 line-clamp-2 text-caption leading-relaxed text-ink-soft max-sm:hidden">
              {p.summary}
            </p>
          ) : null}
        </div>

        <ChevronRight className="size-5 shrink-0 text-ink-faint sm:hidden" />

        <div className="mt-auto hidden pt-5 sm:block">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-soft">
            <span className="flex items-center gap-1.5">
              <ListChecks className="size-4 text-ink-muted" />
              <span className="tabular font-medium text-ink">{p.questionCount}</span> soru
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-ink-muted" />
              <span className="tabular font-medium text-ink">{p.durationMinutes}</span> dk
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-4 text-ink-muted" />
              <span className="tabular font-medium text-ink">{p.topicCount}</span> konu
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
            <span className="text-caption font-semibold text-brand">
              {p.inProgress
                ? "Kaldığın yerden devam et"
                : p.locked
                  ? "Ayrıntıları gör"
                  : "Teste göz at"}
            </span>
            <ChevronRight className="size-4 text-brand transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
