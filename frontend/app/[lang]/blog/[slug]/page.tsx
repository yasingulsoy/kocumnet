import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchBlogBySlug, fetchBlogs, getImageUrl, BACKEND_URL } from "@/lib/api";
import { getSiteUrl } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_HREFLANG, LOCALE_INTL, LOCALE_OG, type Locale } from "@/lib/i18n/config";
import { blogPath, localizedPath } from "@/lib/routes";
import { BlogViewCounter } from "@/components/BlogViewCounter";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, "");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(dateString: string, locale: Locale) {
  return new Date(dateString).toLocaleDateString(LOCALE_INTL[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
      modifiedTime: blog.updated_at,
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
  const readingTime = estimateReadingTime(blog.content);
  const processedContent = processContent(blog.content, BACKEND_URL);
  const authorName =
    blog.author?.first_name && blog.author?.last_name
      ? `${blog.author.first_name} ${blog.author.last_name}`
      : "Koçum.Net";

  const pageUrl = `${siteUrl}${blogPath(slug, lang)}`;

  const relatedResult = await fetchBlogs({ limit: 4, locale: lang });
  const relatedBlogs = (relatedResult?.data || [])
    .filter((b: any) => b.id !== blog.id)
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
    wordCount: blog.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length,
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
    <main className="bg-white text-[#444] antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17305e] via-[#1a5fb4] to-[#0e90d5] py-16 sm:py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6">
          <nav className="mb-8 flex items-center gap-2 text-sm text-white/60" aria-label="Breadcrumb">
            <Link href={localizedPath("home", lang)} className="transition hover:text-white/90">
              {t.blog.breadcrumbHome}
            </Link>
            <span>/</span>
            <Link href={localizedPath("blog", lang)} className="transition hover:text-white/90">
              {t.blog.title}
            </Link>
            <span>/</span>
            <span className="max-w-[200px] truncate text-white/40">{blog.title}</span>
          </nav>

          {blog.tags && blog.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {blog.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            {blog.title}
          </h1>

          {blog.excerpt && (
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/75">{blog.excerpt}</p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                {authorName.charAt(0).toUpperCase()}
              </div>
              <span className="text-white/80">{authorName}</span>
            </div>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <time dateTime={blog.published_at || blog.created_at}>
              {formatDate(blog.published_at || blog.created_at, lang)}
            </time>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>
              {readingTime} {t.blog.readingTime}
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <BlogViewCounter slug={slug} initialCount={blog.view_count} label={t.blog.views} />
          </div>
        </div>
      </section>

      {/* İçerik */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16 lg:px-8">
        {imageUrl && (
          <div className="relative -mt-20 mb-12 overflow-hidden rounded-2xl shadow-2xl">
            <img src={imageUrl} alt={blog.title} className="w-full object-cover" loading="eager" />
          </div>
        )}

        <article
          className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-[#151a33] prose-p:text-[#444] prose-p:leading-relaxed prose-a:text-[#1a5fb4] prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-img:shadow-lg prose-strong:text-[#151a33] prose-blockquote:border-s-[#1a5fb4] prose-blockquote:text-[#555]"
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />

        {/* Paylaş */}
        <div className="mt-12 border-t border-gray-100 pt-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#1a5fb4]">
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
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.667l-5.214-6.817-5.971 6.817h-3.31l7.708-8.832L2.06 2.25h6.795l4.677 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2] transition hover:bg-[#1877F2] hover:text-white"
              aria-label="Facebook"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" /></svg>
            </a>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(blog.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A66C2]/10 text-[#0A66C2] transition hover:bg-[#0A66C2] hover:text-white"
              aria-label="LinkedIn"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${blog.title} - ${pageUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] transition hover:bg-[#25D366] hover:text-white"
              aria-label="WhatsApp"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            </a>
          </div>
        </div>

        {/* Yazar kutusu */}
        <div className="mt-12 rounded-2xl border border-gray-100 bg-gradient-to-br from-[#edf0fa] to-white p-8">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a5fb4] to-[#0e90d5] text-xl font-bold text-white shadow-lg">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5fb4]">{t.blog.author}</p>
              <h2 className="mt-1 text-lg font-bold text-[#151a33]">{authorName}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#666]">{t.blog.authorBio}</p>
            </div>
          </div>
        </div>
      </section>

      {/* İlgili yazılar */}
      {relatedBlogs.length > 0 && (
        <section className="border-t border-gray-100 bg-[#fafbfe] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight text-[#151a33]">
              {t.blog.relatedPosts}
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {relatedBlogs.map((related: any) => (
                <article
                  key={related.id}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <Link
                    href={blogPath(related.slug, lang)}
                    className="relative block aspect-[16/10] overflow-hidden bg-[#edf0fa]"
                  >
                    {related.image ? (
                      <img
                        src={getImageUrl(related.image)!}
                        alt={related.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a5fb4]/10 to-[#0e90d5]/10">
                        <svg className="h-10 w-10 text-[#1a5fb4]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                    )}
                  </Link>
                  <div className="p-6">
                    <time className="text-xs text-[#888]" dateTime={related.published_at || related.created_at}>
                      {formatDate(related.published_at || related.created_at, lang)}
                    </time>
                    <h3 className="mt-2 font-bold text-[#151a33] transition-colors group-hover:text-[#1a5fb4]">
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
          className="inline-flex items-center gap-2 rounded-full bg-[#1a5fb4] px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#154a94] hover:shadow-xl"
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
