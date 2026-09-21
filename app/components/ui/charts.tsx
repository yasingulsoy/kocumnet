import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Grafikler saf SVG — grafik kütüphanesi yok, bilinçli: iki grafik için
 * ~100 KB'lık bir paket indirmek yerine sunucuda çizilip JS'siz gelen,
 * her boyutta keskin kalan birkaç satır.
 */

// ─────────────────────────────────────────────────────────────
// Skor halkası
// ─────────────────────────────────────────────────────────────

export function ScoreRing({
  value,
  size = 168,
  stroke = 14,
  children,
  className,
  label,
}: {
  /** 0-100 */
  value: number;
  size?: number;
  stroke?: number;
  /** Halkanın ortası. */
  children?: ReactNode;
  className?: string;
  /** Ekran okuyucu için. */
  label?: string;
}) {
  const id = useId();
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Sıfırda bile görünür bir başlangıç noktası kalsın; tamamen boş halka
  // "yüklenmedi" gibi duruyor.
  const dash = Math.max(v, 1.5) / 100;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `%${Math.round(v)}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0e90d5" />
            <stop offset="1" stopColor="#1a5fb4" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-brand-wash"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gelişim çizgisi
// ─────────────────────────────────────────────────────────────

export interface TrendPoint {
  /** Eksen etiketi (kısa tarih). */
  label: string;
  /** 0-100 */
  value: number;
  /** Nokta üstüne gelince görünen açıklama. */
  title: string;
}

export function TrendChart({ points, className }: { points: TrendPoint[]; className?: string }) {
  const id = useId();

  // Sabit en-boy oranı: viewBox ölçeklenirken noktalar yuvarlak kalsın
  // (preserveAspectRatio="none" daireleri elips yapıyordu).
  const W = 640;
  const H = 220;
  const pad = { top: 16, right: 16, bottom: 30, left: 36 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const x = (i: number) =>
    pad.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.top + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area =
    points.length > 1
      ? `${line} L${x(points.length - 1)},${pad.top + ih} L${x(0)},${pad.top + ih} Z`
      : "";

  // Çok nokta varsa eksen etiketlerini seyrelt — üst üste binmesinler.
  const step = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Başarı oranının zaman içindeki değişimi"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a5fb4" stopOpacity="0.22" />
          <stop offset="1" stopColor="#1a5fb4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={y(g)}
            y2={y(g)}
            stroke="currentColor"
            strokeDasharray={g === 0 ? undefined : "3 5"}
            className="text-line"
          />
          <text
            x={pad.left - 8}
            y={y(g) + 4}
            textAnchor="end"
            className="fill-ink-faint text-[11px]"
          >
            {g}
          </text>
        </g>
      ))}

      {area ? <path d={area} fill={`url(#${id})`} /> : null}
      {points.length > 1 ? (
        <path
          d={line}
          fill="none"
          stroke="#1a5fb4"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="5" fill="white" stroke="#1a5fb4" strokeWidth="2.5">
            <title>{p.title}</title>
          </circle>
          {i % step === 0 || i === points.length - 1 ? (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-ink-faint text-[11px]"
            >
              {p.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Konu çubuğu
// ─────────────────────────────────────────────────────────────

const LEVEL = {
  STRONG: { bar: "bg-ok-fill", text: "text-ok", label: "Güçlü" },
  MEDIUM: { bar: "bg-warn-fill", text: "text-warn", label: "Orta" },
  WEAK: { bar: "bg-bad-fill", text: "text-bad", label: "Zayıf" },
} as const;

export type Level = keyof typeof LEVEL;

export function levelMeta(level: Level | null) {
  return level ? LEVEL[level] : null;
}

export function TopicBar({
  name,
  ratio,
  correct,
  asked,
  level,
  slow,
}: {
  name: string;
  ratio: number;
  correct: number;
  asked: number;
  level: Level | null;
  slow?: boolean;
}) {
  const meta = levelMeta(level);
  const pct = Math.round(ratio * 100);

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-ink">{name}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs">
          {slow ? <span className="font-medium text-warn">yavaş</span> : null}
          <span className="tabular text-ink-faint">
            {correct}/{asked}
          </span>
          {meta ? (
            <span className={cn("w-12 text-end font-semibold", meta.text)}>{meta.label}</span>
          ) : (
            <span className="w-12 text-end text-ink-faint" title="Seviye için en az 2 soru gerekir">
              —
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunk ring-1 ring-inset ring-line">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", meta ? meta.bar : "bg-line-strong")}
          style={{ width: Math.max(pct, asked > 0 ? 4 : 0) + "%" }}
        />
      </div>
    </div>
  );
}
