/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/avatar/Avatar.tsx + AvatarText.tsx
 *
 * Tek bileşen: `src` varsa görsel, yoksa baş harfler (AvatarText). Baş
 * harfler Türkçe büyük harfle (i → İ). Renk addan türetilir; metin/zemin
 * çiftleri 4.5:1'i geçer (TailAdmin'in …-600 / …-100 çiftleri geçmiyordu).
 * Görsel next/image `unoptimized`: uzak adres için next.config ayarı gerekmez.
 * Projenin kendi büyük fotoğraflarında (public/…) `unoptimized={false}`:
 * Next görseli avatar boyuna küçültür. Durum noktası RTL'de sola geçer (end-0).
 */
import Image from "next/image";
import { cx } from "../cx";

export type AvatarSize = "xsmall" | "small" | "medium" | "large" | "xlarge" | "xxlarge" | "huge";
export type AvatarStatus = "online" | "offline" | "busy" | "none";

const BOYUT: Record<AvatarSize, { kutu: string; piksel: number; yazi: string; nokta: string }> = {
  xsmall: { kutu: "size-6", piksel: 24, yazi: "text-[0.625rem]", nokta: "size-1.5" },
  small: { kutu: "size-8", piksel: 32, yazi: "text-theme-xs", nokta: "size-2" },
  medium: { kutu: "size-10", piksel: 40, yazi: "text-sm", nokta: "size-2.5" },
  large: { kutu: "size-12", piksel: 48, yazi: "text-base", nokta: "size-3" },
  xlarge: { kutu: "size-14", piksel: 56, yazi: "text-lg", nokta: "size-3.5" },
  xxlarge: { kutu: "size-16", piksel: 64, yazi: "text-xl", nokta: "size-4" },
  huge: { kutu: "size-20", piksel: 80, yazi: "text-2xl", nokta: "size-4" },
};

const DURUM: Record<Exclude<AvatarStatus, "none">, string> = {
  online: "bg-success-500",
  offline: "bg-error-400",
  busy: "bg-warning-500",
};

const RENKLER = [
  "bg-brand-100 text-brand-700",
  "bg-success-100 text-success-700",
  "bg-warning-100 text-warning-800",
  "bg-error-100 text-error-700",
  "bg-blue-light-100 text-blue-light-800",
  "bg-orange-100 text-orange-800",
  "bg-gray-100 text-gray-700",
];

/** "Ayşe Nur Yılmaz" → "AY"; tek kelime → ilk harf. */
export function initials(ad: string): string {
  const kelimeler = ad.trim().split(/\s+/).filter(Boolean);
  if (!kelimeler.length) return "?";
  const secilen = kelimeler.length === 1 ? [kelimeler[0]] : [kelimeler[0], kelimeler[kelimeler.length - 1]];
  return secilen.map((k) => k.charAt(0).toLocaleUpperCase("tr-TR")).join("");
}

function renkSinifi(ad: string) {
  let toplam = 0;
  for (const harf of ad) toplam += harf.codePointAt(0) ?? 0;
  return RENKLER[toplam % RENKLER.length];
}

export interface AvatarProps {
  /** Görsel adresi; yoksa baş harfler. */
  src?: string | null;
  /** Kişinin adı: baş harf ve renk buradan, görselin alt metni de. */
  name: string;
  alt?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
  /** true: ekran okuyucudan gizle (ad zaten yanında yazıyorsa). */
  decorative?: boolean;
  /** false: next/image görseli küçültür (yerel fotoğraf). Varsayılan true. */
  unoptimized?: boolean;
}

export function Avatar({ src, name, alt, size = "medium", status = "none", className, decorative = false, unoptimized = true }: AvatarProps) {
  const b = BOYUT[size];
  return (
    <span
      className={cx("relative inline-flex shrink-0 rounded-full", b.kutu, className)}
      role={!src && !decorative ? "img" : undefined}
      aria-label={!src && !decorative ? name : undefined}
      aria-hidden={decorative || undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={decorative ? "" : (alt ?? name)}
          width={b.piksel}
          height={b.piksel}
          unoptimized={unoptimized}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span
          className={cx(
            "flex size-full items-center justify-center rounded-full font-semibold select-none",
            b.yazi,
            renkSinifi(name)
          )}
        >
          {initials(name)}
        </span>
      )}
      {status !== "none" ? (
        <span className={cx("absolute end-0 bottom-0 rounded-full border-[1.5px] border-white", b.nokta, DURUM[status])} />
      ) : null}
    </span>
  );
}

/** TailAdmin uyumu: yalnızca baş harfler. */
export function AvatarText({ name, size = "medium", className }: { name: string; size?: AvatarSize; className?: string }) {
  return <Avatar name={name} size={size} className={className} />;
}
