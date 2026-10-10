import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { getImageUrl } from "@/lib/api";
import { coverAlt, formatDate, postDate, readingMinutes, type BlogPost } from "@/lib/blog";
import { blogPath } from "@/lib/routes";
import type { Locale } from "@/lib/i18n/config";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { KART_GOLGE, LINK_KART, UZANAN_BAGLANTI } from "@/components/ui";

/**
 * Blog yazısı kartı — blog listesi ve "ilgili yazılar" aynı kartı kullanır.
 *
 * TailAdmin'in görselli kartı: kenarlıklı beyaz kart, içinde köşeleri
 * yuvarlak görsel, altında tarih · okuma süresi, başlık, özet. Görselin
 * üstünde ilk etiket (kitin dolu rozeti).
 *
 * Kartta TEK bağlantı var (başlık); `after:` katmanı onu bütün karta
 * yayıyor, kartın her yeri tıklanır. Eskiden görsel, başlık ve "devamını
 * oku" ayrı bağlantılardı: klavyeyle kart başına üç durak, ekran okuyucuda
 * aynı başlık üç kez.
 */
export function BlogCard({
  post,
  lang,
  labels,
  headingLevel = "h2",
  compact = false,
}: {
  post: BlogPost;
  lang: Locale;
  labels: { readingTime: string; readMore: string };
  /** Sayfadaki başlık hiyerarşisine göre: liste h2, "ilgili yazılar" h3. */
  headingLevel?: "h2" | "h3";
  /** Özet ve "devamını oku" satırı olmadan (ilgili yazılar). */
  compact?: boolean;
}) {
  const Baslik = headingLevel;
  const gorsel = getImageUrl(post.image);
  const etiket = post.tags?.[0];

  return (
    <article className={cx("flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-3", KART_GOLGE, LINK_KART)}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gray-100">
        {gorsel ? (
          /* Yönetimde kapak açıklaması yazıldıysa o okunur; yoksa görsel süs
             sayılır (başlık hemen altında, aynı başlığı ikinci kez okutmasın). */
          <Image
            src={gorsel}
            alt={coverAlt(post, "")}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes={compact ? "(min-width: 1024px) 330px, (min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-brand-50">
            <BookOpen className="size-10 text-brand-300" aria-hidden />
          </div>
        )}
        {etiket ? (
          <Badge variant="solid" size="sm" className="absolute start-3 top-3">
            {etiket}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-2 pt-4 pb-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs text-gray-500">
          <time dateTime={postDate(post)}>{formatDate(postDate(post), lang)}</time>
          <span className="size-1 rounded-full bg-gray-300" aria-hidden />
          <span>
            {readingMinutes(post)} {labels.readingTime}
          </span>
        </p>
        <Baslik className="font-display mt-2.5 text-lg leading-snug font-semibold text-gray-800 transition-colors group-hover:text-brand-500">
          <Link href={blogPath(post.slug, lang)} className={UZANAN_BAGLANTI}>
            {post.title}
          </Link>
        </Baslik>
        {!compact && post.excerpt ? <p className="mt-2 line-clamp-3 flex-1 text-sm text-gray-500">{post.excerpt}</p> : null}
        {!compact ? (
          <span aria-hidden className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500">
            {labels.readMore}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
