/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/images/ResponsiveImage.tsx,
 * TwoColumnImageGrid.tsx, ThreeColumnImageGrid.tsx
 *
 * Kenarlıklı, köşeleri yuvarlak görsel ve 2/3 sütunlu ızgara. next/image:
 * genişlik/yükseklik verilir, sayfa kaymaz. Uzak (backend) görselde
 * next.config'e adres eklemek istemezsen `unoptimized`. Sayfanın en büyük
 * görseli (hero) için `preload` (Next 16; `priority` eski adı).
 */
import Image from "next/image";
import { cx } from "../cx";

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  unoptimized?: boolean;
  /** Next 16'da kullanımdan kalktı; yerine `preload`. */
  priority?: boolean;
  /** <head>'de önceden yükle, geç yükleme yok: LCP görseli (hero). */
  preload?: boolean;
  /** Görsel kutusunun en-boy oranı; verilirse görsel kırpılarak sığar. */
  aspect?: "video" | "square" | "4/3" | "og";
  className?: string;
  sizes?: string;
}

const ORAN = { video: "aspect-video", square: "aspect-square", "4/3": "aspect-4/3", og: "aspect-[1.91/1]" } as const;

export function ResponsiveImage({ src, alt, width, height, unoptimized, priority, preload, aspect, className, sizes = "100vw" }: ResponsiveImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      unoptimized={unoptimized}
      // İkisi birlikte verilirse Next hata fırlatır: preload kazanır.
      preload={preload}
      priority={preload ? undefined : priority}
      className={cx("w-full rounded-xl border border-gray-200", aspect ? cx(ORAN[aspect], "object-cover") : "h-auto", className)}
    />
  );
}

export interface ImageGridItem {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export function ImageGrid({ items, columns = 2, unoptimized, className }: { items: ImageGridItem[]; columns?: 2 | 3; unoptimized?: boolean; className?: string }) {
  return (
    <div className={cx("grid grid-cols-1 gap-5", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2", className)}>
      {items.map((g) => (
        <ResponsiveImage key={g.src} {...g} unoptimized={unoptimized} sizes={columns === 3 ? "(min-width: 640px) 33vw, 100vw" : "(min-width: 640px) 50vw, 100vw"} />
      ))}
    </div>
  );
}
