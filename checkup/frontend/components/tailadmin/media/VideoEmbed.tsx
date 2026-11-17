/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/video/YouTubeEmbed.tsx
 * (+ components/videos/* oran bileşenleri)
 *
 * YouTube gömme, oran seçmeli (16:9, 4:3, 21:9, 1:1). Fark: çerezsiz alan
 * adı (youtube-nocookie.com) ve geç yükleme (loading="lazy"); başlık
 * zorunlu (iframe'in erişilebilir adı).
 */
import { cx } from "../cx";

type Oran = "16:9" | "4:3" | "21:9" | "1:1";

const ORAN: Record<Oran, string> = {
  "16:9": "aspect-video",
  "4:3": "aspect-4/3",
  "21:9": "aspect-21/9",
  "1:1": "aspect-square",
};

export interface VideoEmbedProps {
  videoId: string;
  title: string;
  aspectRatio?: Oran;
  className?: string;
}

export function VideoEmbed({ videoId, title, aspectRatio = "16:9", className }: VideoEmbedProps) {
  return (
    <div className={cx("overflow-hidden rounded-lg", ORAN[aspectRatio], className)}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="size-full border-0"
      />
    </div>
  );
}
