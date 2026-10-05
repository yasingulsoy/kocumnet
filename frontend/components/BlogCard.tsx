import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { getImageUrl } from "@/lib/api";
import { coverAlt, formatDate, postDate, readingMinutes, type BlogPost } from "@/lib/blog";
import { blogPath } from "@/lib/routes";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui";

/**
 * Blog yazısı kartı — blog listesi ve "ilgili yazılar" aynı kartı kullanır.
 *
 * Eskiden iki ayrı kopya vardı (biri ham `border-gray-100 bg-white`, öteki
 * satır içi SVG ile) ve her kartta aynı yazıya giden ÜÇ bağlantı vardı
 * (görsel, başlık, "devamını oku"): klavyeyle her kart üç durak, ekran
 * okuyucuda aynı başlık üç kez. Artık tek bağlantı başlıkta; `after:`
 * katmanı onu bütün karta yayıyor, kartın her yeri tıklanır.
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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-sunk">
        {gorsel ? (
          /* Yönetimde kapak açıklaması yazıldıysa o okunur; yoksa görsel süs
             sayılır (başlık hemen altında, aynı başlığı ikinci kez okutmasın). */
          <Image
            src={gorsel}
            alt={coverAlt(post, "")}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes={compact ? "(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 350px, (min-width: 640px) 50vw, 100vw"}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-brand-wash">
            <BookOpen className="size-10 text-brand/30" aria-hidden />
          </div>
        )}
        {etiket ? (
          <Badge tone="solid" className="absolute start-4 top-4">
            {etiket}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-faint">
          <time dateTime={postDate(post)}>{formatDate(postDate(post), lang)}</time>
          <span className="size-1 rounded-full bg-line-strong" aria-hidden />
          <span>
            {readingMinutes(post)} {labels.readingTime}
          </span>
        </p>
        <Baslik className="font-display mt-3 text-h4 font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
          <Link
            href={blogPath(post.slug, lang)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {post.title}
          </Link>
        </Baslik>
        {!compact && post.excerpt ? (
          <p className="mt-2 line-clamp-3 flex-1 text-caption text-ink-soft">{post.excerpt}</p>
        ) : null}
        {!compact ? (
          <span
            aria-hidden
            className="mt-4 inline-flex items-center gap-2 text-caption font-semibold text-brand"
          >
            {labels.readMore}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
