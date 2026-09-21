import Link from "next/link";
import { ArrowRight, Clock, Layers, ListChecks, Lock, Play } from "lucide-react";
import { Badge, Card } from "@/components/ui";
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
  /** Bu pakette süresi dolmamış, yarım bir test var mı. */
  inProgress: boolean;
  /** Bu paketi daha önce kaç kez bitirdi. */
  timesTaken?: number;
}

/**
 * Paket kartı. Tıklanınca DOĞRUDAN TEST BAŞLAMAZ — önce ayrıntı ekranı
 * açılır. Eskiden karttaki düğme süreyi hemen başlatıyordu; paketin ne
 * sorduğunu, kaç dakika süreceğini görmeden sayaç işlemeye başlıyordu.
 */
export function PackageCard({ p }: { p: PackageCardData }) {
  const ayt = p.examScope === "AYT";

  return (
    <Link href={"/paketler/" + p.slug} className="group block h-full">
      <Card interactive className="relative flex h-full flex-col overflow-hidden p-5">
        {/* Sınav türüne göre ince üst şerit: TYT mavi, AYT lacivert. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-1",
            ayt ? "bg-brand-deep" : "bg-brand-gradient"
          )}
        />

        <div className="flex items-center justify-between gap-2">
          <Badge tone={ayt ? "dark" : "brand"}>{p.examScope}</Badge>
          {p.inProgress ? (
            <Badge tone="warn">
              <Play /> Devam ediyor
            </Badge>
          ) : p.locked ? (
            <Badge tone="neutral">
              <Lock /> Kilitli
            </Badge>
          ) : p.timesTaken ? (
            <span className="text-[11px] font-medium text-ink-faint">{p.timesTaken} kez çözdün</span>
          ) : null}
        </div>

        <h3 className="font-display mt-3.5 text-[17px] font-semibold leading-snug text-ink">
          {p.name}
        </h3>
        {p.summary ? (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft">
            {p.summary}
          </p>
        ) : null}

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-soft">
            <span className="flex items-center gap-1.5">
              <ListChecks className="size-4 text-ink-faint" />
              <span className="tabular font-medium text-ink">{p.questionCount}</span> soru
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-ink-faint" />
              <span className="tabular font-medium text-ink">{p.durationMinutes}</span> dk
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-4 text-ink-faint" />
              <span className="tabular font-medium text-ink">{p.topicCount}</span> konu
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
            <span className="text-[13px] font-semibold text-brand">
              {p.inProgress ? "Kaldığın yerden devam et" : p.locked ? "Ayrıntıları gör" : "Teste göz at"}
            </span>
            <ArrowRight className="size-4 text-brand transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
