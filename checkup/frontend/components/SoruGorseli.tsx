import { cx } from "@/components/tailadmin/cx";

/**
 * Soru görseli: /medya/[id] rotasından (backend'den aktarılır). Genişliğe
 * sığar, oranı korunur. next/image kullanılmıyor: görsel backend'de zaten
 * 1200 px'e küçültülüp WebP'ye çevriliyor (API.md "Görsel yükleme").
 */
export function SoruGorseli({ id, className, oncelikli = false }: { id: string | number; className?: string; oncelikli?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- kendi /medya rotamız; boyutlandırma backend'de
    <img
      src={`/medya/${encodeURIComponent(String(id))}`}
      alt="Soruya ait görsel"
      loading={oncelikli ? "eager" : "lazy"}
      decoding="async"
      className={cx("mx-auto block h-auto max-w-full rounded-lg border border-gray-200 bg-white", className)}
    />
  );
}
