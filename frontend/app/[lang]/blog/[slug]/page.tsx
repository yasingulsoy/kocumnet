import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { jsonLd } from "@/lib/jsonld";
import { fetchBlogBySlug, fetchBlogs, getImageUrl, BACKEND_URL } from "@/lib/api";
import { getSiteUrl } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_HREFLANG, LOCALE_OG } from "@/lib/i18n/config";
import { blogPath, localizedPath } from "@/lib/routes";
import Image from "next/image";
import { FacebookIcon, LinkedInIcon, WhatsAppIcon, XIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { BlogViewCounter } from "@/components/BlogViewCounter";
import { authorName as yazarAdi, formatDate, postDate, readingMinutes } from "@/lib/blog";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

/** İçerikteki relatif /uploads/... yollarını backend'e çözer. */
function processContent(html: string, backendUrl: string): string {
  return html.replace(/src="(\/uploads\/[^"]+)"/g, `src="${backendUrl}$1"`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const blog = await fetchBlogBySlug(slug);
  const t = await getDictionary(lang);

  if (!blog) {
    return { title: t.blog.notFound };
  }

  const title = blog.meta_title || blog.title;
  const description = blog.meta_description || blog.excerpt || "";
  const imageUrl = blog.image ? getImageUrl(blog.image) : null;
  const path = blogPath(slug, lang);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | Koçum.Net`,
      description,
      url: path,
      type: "article",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
      publishedTime: blog.published_at || blog.created_at,
      modifiedTime: blog.updated_at ?? undefined,
      ...(imageUrl ? { images: [{ url: imageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Koçum.Net`,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const blog = await fetchBlogBySlug(slug);
  if (!blog) notFound();

  const t = await getDictionary(lang);
  const siteUrl = getSiteUrl();
  const imageUrl = getImageUrl(blog.image);
  const readingTime = readingMinutes(blog);
  // İçeriği boş bir yazı da gelebilir (taslaktan yayına alınmış, gövdesi
  // silinmiş). Eskiden burada .replace() çağrılıyordu ve sayfa 500 veriyordu.
  const processedContent = blog.content ? processContent(blog.content, BACKEND_URL) : "";
  const authorName = yazarAdi(blog) ?? "Koçum.Net";

  const pageUrl = `${siteUrl}${blogPath(slug, lang)}`;

  const relatedResult = await fetchBlogs({ limit: 4, locale: lang });
  const relatedBlogs = (relatedResult?.data || [])
    .filter((b) => b.id !== blog.id)
    .slice(0, 3);

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title,
    description: blog.meta_description || blog.excerpt || "",
    image: imageUrl || undefined,
    datePublished: blog.published_at || blog.created_at,
    dateModified: blog.updated_at,
    author: { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: "Koçum.Net",
      url: siteUrl,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    wordCount: (blog.content ?? "").replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length,
    inLanguage: LOCALE_HREFLANG[lang],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.blog.breadcrumbHome, item: `${siteUrl}${localizedPath("home", lang)}` },
      { "@type": "ListItem", position: 2, name: t.blog.title, item: `${siteUrl}${localizedPath("blog", lang)}` },
      { "@type": "ListItem", position: 3, name: blog.title, item: pageUrl },
    ],
  };

  return (
    <main className="bg-white text-ink-soft antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogPostingSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />

      {/*
        Blog detayında koyu hero KALIYOR (tone="deep"): yazının kendisi uzun
        bir okuma, başlığın gövde metninden net ayrılması gerekiyor. Diğer
        iç sayfalarda gradyan bant kaldırıldı.
      */}
      <PageHero
        tone="deep"
        title={blog.title}
        description={blog.excerpt ?? undefined}
        breadcrumb={
          <nav className="flex items-center gap-2 text-caption text-white/60" aria-label="Breadcrumb">
            <Link href={localizedPath("home", lang)} className="transition hover:text-white/90">
              {t.blog.breadcrumbHome}
            </Link>
            <span aria-hidden>/</span>
            <Link href={localizedPath("blog", lang)} className="transition hover:text-white/90">
              {t.blog.title}
            </Link>
            <span aria-hidden>/</span>
            <span className="max-w-[200px] truncate text-white/40">{blog.title}</span>
          </nav>
        }
      >
        <div className="space-y-6">
          {blog.tags && blog.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {blog.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 px-3 py-1 text-micro font-semibold uppercase tracking-wider text-white"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-caption text-white/60">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-white/20 text-caption font-bold text-white">
                {authorName.charAt(0).toUpperCase()}
              </div>
              <span className="text-white/80">{authorName}</span>
            </div>
            <span className="size-1 rounded-full bg-white/30" aria-hidden />
            <time dateTime={postDate(blog)}>{formatDate(postDate(blog), lang)}</time>
            <span className="size-1 rounded-full bg-white/30" aria-hidden />
            <span>
              {readingTime} {t.blog.readingTime}
            </span>
            <span className="size-1 rounded-full bg-white/30" aria-hidden />
            <BlogViewCounter slug={slug} initialCount={blog.view_count ?? 0} label={t.blog.views} />
          </div>
        </div>
      </PageHero>

      {/* İçerik */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16 lg:px-8">
        {imageUrl && (
          <div className="relative -mt-20 mb-12 overflow-hidden rounded-2xl shadow-2xl">
            <Image
              src={imageUrl}
              alt={blog.title}
              width={1280}
              height={720}
              priority
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 896px, 100vw"
            />
          </div>
        )}

        <article
          className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-ink prose-p:text-ink-soft prose-p:leading-relaxed prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-img:shadow-lg prose-strong:text-ink prose-blockquote:border-s-brand prose-blockquote:text-ink-soft"
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />

        {/* Paylaş */}
        <div className="mt-12 border-t border-line pt-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand">
            {t.blog.share}
          </p>
          <div className="flex gap-3">
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(blog.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DA1F2]/10 text-[#1DA1F2] transition hover:bg-[#1DA1F2] hover:text-white"
              aria-label="X / Twitter"
            >
              <XIcon className="size-4" />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2] transition hover:bg-[#1877F2] hover:text-white"
              aria-label="Facebook"
            >
              <FacebookIcon className="size-4" />
            </a>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(blog.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A66C2]/10 text-[#0A66C2] transition hover:bg-[#0A66C2] hover:text-white"
              aria-label="LinkedIn"
            >
              <LinkedInIcon className="size-4" />
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${blog.title} - ${pageUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] transition hover:bg-[#25D366] hover:text-white"
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="size-4" />
            </a>
          </div>
        </div>

        {/* Yazar kutusu */}
        <div className="mt-12 rounded-2xl border border-line bg-surface-sunk p-8">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xl font-bold text-white shadow-raised">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.blog.author}</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{authorName}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.blog.authorBio}</p>
            </div>
          </div>
        </div>
      </section>

      {/* İlgili yazılar */}
      {relatedBlogs.length > 0 && (
        <section className="border-t border-line bg-surface-sunk py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight text-ink">
              {t.blog.relatedPosts}
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {relatedBlogs.map((related) => (
                <article
                  key={related.id}
                  className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <Link
                    href={blogPath(related.slug, lang)}
                    className="relative block aspect-[16/10] overflow-hidden bg-surface-sunk"
                  >
                    {related.image ? (
                      <Image
                          src={getImageUrl(related.image)!}
                          alt={related.title}
                          fill
                          className="object-cover"
                          sizes="(min-width: 1024px) 300px, 50vw"
                        />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-brand-wash">
                        <svg className="h-10 w-10 text-brand/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                    )}
                  </Link>
                  <div className="p-6">
                    <time className="text-xs text-ink-faint" dateTime={related.published_at || related.created_at}>
                      {formatDate(postDate(related), lang)}
                    </time>
                    <h3 className="mt-2 font-bold text-ink transition-colors group-hover:text-brand">
                      <Link href={blogPath(related.slug, lang)}>{related.title}</Link>
                    </h3>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12 text-center">
        <Link
          href={localizedPath("blog", lang)}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-hover hover:shadow-xl"
        >
          <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {t.blog.backToBlog}
        </Link>
      </section>
    </main>
  );
}
