import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchBlogs, getImageUrl } from "@/lib/api";
import { StaggerGroup, StaggerItem } from "@/components/Reveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_INTL, LOCALE_OG, type Locale } from "@/lib/i18n/config";
import { blogPath, languageAlternates, localizedPath } from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);

  return {
    title: t.blog.title,
    description: t.blog.metaDescription,
    alternates: {
      canonical: localizedPath("blog", lang),
      languages: languageAlternates("blog"),
    },
    openGraph: {
      title: `${t.blog.title} | Koçum.Net`,
      description: t.blog.metaDescription,
      url: localizedPath("blog", lang),
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
    },
  };
}

function formatDate(dateString: string, locale: Locale) {
  return new Date(dateString).toLocaleDateString(LOCALE_INTL[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, "");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default async function BlogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  // Yalnızca bu dildeki yazılar
  const result = await fetchBlogs({ limit: 20, locale: lang });
  const blogs = result?.data || [];

  return (
    <main className="bg-white text-[#444] antialiased">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17305e] via-[#1a5fb4] to-[#0e90d5] py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
            {t.blog.eyebrow}
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t.blog.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
            {t.blog.subtitle}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:px-8">
        {blogs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#edf0fa]">
              <svg className="h-10 w-10 text-[#1a5fb4]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#151a33]">{t.blog.emptyTitle}</h2>
            <p className="mt-3 text-[#444]">{t.blog.emptyDesc}</p>
          </div>
        ) : (
          <StaggerGroup className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((blog: any) => (
              <StaggerItem
                key={blog.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <Link
                  href={blogPath(blog.slug, lang)}
                  className="relative aspect-[16/10] overflow-hidden bg-[#edf0fa]"
                >
                  {blog.image ? (
                    <img
                      src={getImageUrl(blog.image)!}
                      alt={blog.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a5fb4]/10 to-[#0e90d5]/10">
                      <svg className="h-12 w-12 text-[#1a5fb4]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                  )}
                  {blog.tags && blog.tags.length > 0 && (
                    <span className="absolute start-4 top-4 rounded-full bg-[#1a5fb4] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md">
                      {blog.tags[0]}
                    </span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3 text-xs text-[#888]">
                    <time dateTime={blog.published_at || blog.created_at}>
                      {formatDate(blog.published_at || blog.created_at, lang)}
                    </time>
                    <span className="h-1 w-1 rounded-full bg-[#ccc]" />
                    <span>
                      {estimateReadingTime(blog.content)} {t.blog.readingTime}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold leading-snug text-[#151a33] transition-colors group-hover:text-[#1a5fb4]">
                    <Link href={blogPath(blog.slug, lang)}>{blog.title}</Link>
                  </h2>
                  {blog.excerpt && (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666] line-clamp-3">
                      {blog.excerpt}
                    </p>
                  )}
                  <Link
                    href={blogPath(blog.slug, lang)}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1a5fb4] transition-colors hover:text-[#154a94]"
                  >
                    {t.blog.readMore}
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </section>
    </main>
  );
}
