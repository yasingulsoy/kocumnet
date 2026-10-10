import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { KART_GOLGE } from "@/components/ui";
import type { IcindekilerOgesi } from "@/lib/blog-content";

/*
 * Blog yazısının ortak parçaları. Sitedeki yazı sayfası
 * (app/[lang]/blog/[slug]) ve yönetimdeki önizleme
 * (app/admin/(panel)/blog/[id]/onizleme) aynı işaretlemeyi buradan alır:
 * önizleme sitedeki görünümden kaymasın.
 */

/** Yazı gövdesi: typography eklentisi, kitin gri ve marka tonları; satır ~75 karakter. */
export const MAKALE_PROSE =
  "prose prose-lg max-w-none prose-headings:font-display prose-headings:text-gray-800 prose-p:text-gray-600 prose-p:leading-relaxed " +
  "prose-li:text-gray-600 prose-a:text-brand-500 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-800 " +
  "prose-blockquote:border-s-brand-500 prose-blockquote:text-gray-600";

/**
 * Kapak: lacivert başlığın altına taşan, kitin görsel kutusu gibi çerçeveli
 * görsel. z-10: başlık (PageHero) ızgara deseni için `relative z-1`; kapak
 * onun üstüne çizilsin, taşan kısmı altında kalmasın.
 */
export const KAPAK_DIS = "mx-auto w-full max-w-4xl px-5 sm:px-6";
export const KAPAK_CERCEVE = "relative z-10 -mt-12 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-xl sm:-mt-16";
export const KAPAK_GORSEL = "h-auto w-full rounded-xl object-cover";

/** Lacivert başlıktaki etiketler (kitin dolu rozeti). */
export function YaziEtiketleri({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge variant="solid" size="sm">
            {tag}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Lacivert başlıktaki yazar · tarih · okuma süresi (· görüntülenme) satırı. */
export function YaziBilgisi({
  yazar,
  tarih,
  tarihMetni,
  okuma,
  ek,
}: {
  yazar: string;
  /** ISO tarih (time öğesinin dateTime'ı). */
  tarih: string;
  tarihMetni: string;
  okuma: string;
  ek?: ReactNode;
}) {
  const nokta = <span aria-hidden className="size-1 rounded-full bg-gray-500" />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-theme-sm text-gray-300">
      <span className="flex items-center gap-2.5">
        <Avatar name={yazar} size="small" decorative />
        <span className="font-medium text-white">{yazar}</span>
      </span>
      {nokta}
      <time dateTime={tarih}>{tarihMetni}</time>
      {nokta}
      <span>{okuma}</span>
      {ek ? (
        <>
          {nokta}
          {ek}
        </>
      ) : null}
    </div>
  );
}

/** Dar ekranda yazının başındaki açılır içindekiler (sunucuda çizilir, JS gerektirmez). */
export function IcindekilerKutusu({ items, label, className }: { items: IcindekilerOgesi[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx("rounded-2xl border border-gray-200 bg-gray-50", className)}>
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-theme-xs font-medium tracking-wide text-gray-500 uppercase [&::-webkit-details-marker]:hidden">
          {label}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ol className="space-y-2 border-t border-gray-200 px-5 py-4 text-base">
          {items.map((oge) => (
            <li key={oge.id} className={oge.seviye === 3 ? "ps-4 text-sm" : undefined}>
              <a href={`#${oge.id}`} className="text-gray-600 underline-offset-4 transition hover:text-brand-500 hover:underline">
                {oge.metin}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}

/** Yazar kutusu: kitin kartı, avatarı ve rozeti. */
export function YazarKutusu({ ad, etiket, bio, className }: { ad: string; etiket: string; bio: string; className?: string }) {
  return (
    <Card className={cx(KART_GOLGE, "flex items-start gap-5 p-6 sm:p-8", className)}>
      <Avatar name={ad} size="xlarge" decorative />
      <div className="min-w-0">
        <Badge size="sm">{etiket}</Badge>
        <p className="font-display mt-2 text-lg font-semibold text-gray-800">{ad}</p>
        <p className="mt-1.5 text-sm text-gray-500">{bio}</p>
      </div>
    </Card>
  );
}
