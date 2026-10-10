import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { MeterList, type MeterTone } from "@/components/tailadmin/charts/MeterList";
import type { TopicLevel } from "@/lib/scoring";

/*
 * Konu seviyesi (Güçlü / Orta / Zayıf) — sonuç, gelişim ve pano aynı dili
 * konuşsun diye tek yerde. Seviye puanlamadan gelir (lib/scoring.ts): bir
 * konuda yeterli soru yoksa seviye YOK (null) ve rozet "—" yazar; tek
 * soruya bakıp "zayıfsın" demiyoruz.
 */

const SEVIYE: Record<TopicLevel, { etiket: string; renk: BadgeColor; ton: MeterTone }> = {
  STRONG: { etiket: "Güçlü", renk: "success", ton: "success" },
  MEDIUM: { etiket: "Orta", renk: "warning", ton: "warning" },
  WEAK: { etiket: "Zayıf", renk: "error", ton: "error" },
};

export function seviyeBilgisi(level: TopicLevel | null) {
  return level ? SEVIYE[level] : null;
}

/** Seviye rozeti; seviye yoksa gri "—" (üstüne gelince nedeni). */
export function SeviyeRozeti({ level }: { level: TopicLevel | null }) {
  const s = seviyeBilgisi(level);
  if (!s) {
    return (
      <Badge size="sm" color="light" title="Seviye için bu konuda yeterli soru yok">
        —
      </Badge>
    );
  }
  return (
    <Badge size="sm" color={s.renk}>
      {s.etiket}
    </Badge>
  );
}

export interface KonuSatiri {
  topicId: string;
  name: string;
  /** 0-1 */
  ratio: number;
  correct: number;
  asked: number;
  level: TopicLevel | null;
  /** Hedef süreyi belirgin aşan konu. */
  slow?: boolean;
}

/**
 * Konu haritası: her konu bir satır — ad + seviye rozeti, "4/6 doğru",
 * başarı oranı çubuğu (seviye renginde) ve yüzde. Kitin MeterList'i;
 * çubuk 0-100 ölçeğinde (en iyi konuya göre değil: %50 her yerde yarım).
 */
export function KonuHaritasi({ konular, className }: { konular: KonuSatiri[]; className?: string }) {
  return (
    <MeterList
      max={100}
      // Konu adı kesilmez: telefonda "Sayı - Kesi…" okunmuyordu.
      wrap
      className={className}
      items={konular.map((t) => {
        const pct = Math.round(t.ratio * 100);
        return {
          key: t.topicId,
          label: t.name,
          badge: <SeviyeRozeti level={t.level} />,
          meta: (
            <span className="tabular">
              {t.correct}/{t.asked} doğru
              {t.slow ? <span className="font-medium text-warning-700"> · yavaş</span> : null}
            </span>
          ),
          value: pct,
          valueLabel: `%${pct}`,
          tone: seviyeBilgisi(t.level)?.ton ?? "gray",
        };
      })}
    />
  );
}
