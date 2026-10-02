import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchBlogs, getImageUrl } from "@/lib/api";
import Image from "next/image";
import { ArrowRight, BookOpen } from "lucide-react";
import { StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { Badge, Container, EmptyStateBox, Section } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_OG } from "@/lib/i18n/config";
import { blogPath, languageAlternates, localizedPath } from "@/lib/routes";
import { formatDate, postDate, readingMinutes } from "@/lib/blog";

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

export default async function BlogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  // Yalnızca bu dildeki yazılar
  const result = await fetchBlogs({ limit: 20, locale: lang });
  const blogs = result?.data || [];

  return (
    <main>
      <PageHero eyebrow={t.blog.eyebrow} title={t.blog.title} description={t.blog.subtitle} />

      <Section>
        <Container>
        {blogs.length === 0 ? (
          <EmptyStateBox
            icon={<BookOpen />}
            title={t.blog.emptyTitle}
            description={t.blog.emptyDesc}
          />
        ) : (
          <StaggerGroup className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((blog) => (
              <StaggerItem
                key={blog.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <Link
                  href={blogPath(blog.slug, lang)}
                  className="relative aspect-[16/10] overflow-hidden bg-surface-sunk"
                >
                  {blog.image ? (
                    /* next/image: eskiden düz <img> ile servis ediliyordu,
                       next.config.ts'teki remotePatterns tanımlı olmasına
                       rağmen optimizasyon hiç devreye girmiyordu. */
                    <Image
                      src={getImageUrl(blog.image)!}
                      alt={blog.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-wash">
                      <BookOpen className="size-10 text-brand/30" />
                    </div>
                  )}
                  {blog.tags && blog.tags.length > 0 ? (
                    <Badge tone="brand" className="absolute start-4 top-4 bg-brand text-white ring-transparent">
                      {blog.tags[0]}
                    </Badge>
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3 text-micro text-ink-faint">
                    <time dateTime={blog.published_at || blog.created_at}>
                      {formatDate(postDate(blog), lang)}
                    </time>
                    <span className="size-1 rounded-full bg-line-strong" />
                    <span>
                      {readingMinutes(blog)} {t.blog.readingTime}
                    </span>
                  </div>
                  <h2 className="font-display mt-3 text-h4 font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
                    <Link href={blogPath(blog.slug, lang)}>{blog.title}</Link>
                  </h2>
                  {blog.excerpt && (
                    <p className="mt-2 line-clamp-3 flex-1 text-caption text-ink-soft">
                      {blog.excerpt}
                    </p>
                  )}
                  <Link
                    href={blogPath(blog.slug, lang)}
                    className="mt-4 inline-flex items-center gap-2 text-caption font-semibold text-brand transition-colors hover:text-brand-hover"
                  >
                    {t.blog.readMore}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
        </Container>
      </Section>
    </main>
  );
}
