import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { jsonLd } from "@/lib/jsonld";
import { fetchBlogBySlug, fetchBlogs, getImageUrl, BACKEND_URL } from "@/lib/api";
import { getSiteUrl } from "@/lib/site";
import { siteOgImage } from "@/lib/seo";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_HREFLANG, LOCALE_OG, type Locale } from "@/lib/i18n/config";
import { blogPath, localizedPath } from "@/lib/routes";
import { FacebookIcon, LinkedInIcon, WhatsAppIcon, XIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { BlogCard } from "@/components/BlogCard";
import { BlogToc } from "@/components/BlogToc";
import { BlogViewCounter } from "@/components/BlogViewCounter";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import {
  IcindekilerKutusu,
  KAPAK_CERCEVE,
  KAPAK_DIS,
  KAPAK_GORSEL,
  MAKALE_PROSE,
  YaziBilgisi,
  YaziEtiketleri,
  YazarKutusu,
} from "@/components/BlogArticle";
import { Container, Section } from "@/components/ui";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import {
  authorName as yazarAdi,
  coverAlt,
  formatDate,
  postDate,
  readingMinutes,
  relatedPosts,
  type BlogPost,
} from "@/lib/blog";
import { blogIceriginiHazirla, ICINDEKILER_ALT_SINIR } from "@/lib/blog-content";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

/**
 * Yazının kendi dili. Slug bütün dillerde tekil (backend: unique), yani her
 * yazının TEK doğru adresi var. Eskiden /en/blog/<türkçe-yazı> da açılıyordu:
 * Türkçe metin İngilizce arayüzle, yanlış `lang` ile ve kendine işaret eden
 * kanonik adresle — aynı yazı üç adreste, Arapça yazı kökte soldan sağa.
 */
function yaziDili(blog: BlogPost, istenen: Locale): Locale {
  const dil = blog.locale ?? "";
  return isLocale(dil) ? dil : istenen;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const blog = await fetchBlogBySlug(slug);
  const t = await getDictionary(lang);

  if (!blog) {
    return { title: t.blog.notFound };
  }

  const dil = yaziDili(blog, lang);
  const title = blog.meta_title || blog.title;
  const description = blog.meta_description || blog.excerpt || "";
  const kapak = getImageUrl(blog.image);
  // Kapaksız yazı paylaşılınca görselsiz çıkmasın: sitenin paylaşım görseli.
  const gorsel = kapak
    ? { url: kapak, width: 1200, height: 630, alt: coverAlt(blog, blog.title) }
    : siteOgImage(dil);
  const path = blogPath(slug, dil);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | Koçum.Net`,
      description,
      url: path,
      type: "article",
      locale: LOCALE_OG[dil],
      siteName: "Koçum.Net",
      publishedTime: postDate(blog),
      modifiedTime: blog.updated_at ?? undefined,
      ...(blog.tags?.length ? { tags: blog.tags } : {}),
      images: [gorsel],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Koçum.Net`,
      description,
      images: [gorsel.url],
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const blog = await fetchBlogBySlug(slug);
  if (!blog) notFound();

  const dil = yaziDili(blog, lang);
  if (dil !== lang) permanentRedirect(blogPath(slug, dil));

  const t = await getDictionary(lang);
  const siteUrl = getSiteUrl();
  const imageUrl = getImageUrl(blog.image);
  const readingTime = readingMinutes(blog);
  const { html, icindekiler } = blogIceriginiHazirla(blog.content, BACKEND_URL);
  const yazar = yazarAdi(blog);
  const authorName = yazar ?? "Koçum.Net";

  const pageUrl = `${siteUrl}${blogPath(slug, lang)}`;

  // Aynı etiketi taşıyanlar önce; aday havuzu son 12 yazı (içeriksiz liste).
  const adaylar = (await fetchBlogs({ limit: 12, locale: lang }))?.data ?? [];
  const relatedBlogs = relatedPosts(blog, adaylar, 3);

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title,
    description: blog.meta_description || blog.excerpt || "",
    image: imageUrl ?? `${siteUrl}${siteOgImage(lang).url}`,
    datePublished: postDate(blog),
    // null bırakılırsa doğrulayıcı "geçersiz tarih" der; yoksa hiç yazma.
    ...(blog.updated_at ? { dateModified: blog.updated_at } : {}),
    author: yazar
      ? { "@type": "Person", name: yazar }
      : { "@type": "Organization", name: "Koçum.Net", url: siteUrl },
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Koçum.Net",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/icons/icon-512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    wordCount: (blog.content ?? "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length,
    inLanguage: LOCALE_HREFLANG[lang],
    ...(blog.tags?.length ? { keywords: blog.tags.join(", ") } : {}),
  };

  const paylasim = [
    {
      ad: "X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(blog.title)}`,
      Ikon: XIcon,
    },
    {
      ad: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
      Ikon: FacebookIcon,
    },
    {
      ad: "LinkedIn",
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(blog.title)}`,
      Ikon: LinkedInIcon,
    },
    {
      ad: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${blog.title} - ${pageUrl}`)}`,
      Ikon: WhatsAppIcon,
    },
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogPostingSchema) }} />
      <BreadcrumbJsonLd
        items={[
          { name: t.blog.breadcrumbHome, path: localizedPath("home", lang) },
          { name: t.blog.title, path: localizedPath("blog", lang) },
          { name: blog.title, path: blogPath(slug, lang) },
        ]}
      />

      {/*
        Blog detayında koyu başlık KALIYOR (tone="deep"): yazının kendisi uzun
        bir okuma, başlığın gövde metninden net ayrılması gerekiyor. İz,
        kitin PageBreadcrumb'ı gibi ok ayraçlı.
      */}
      <PageHero
        tone="deep"
        title={blog.title}
        description={blog.excerpt ?? undefined}
        breadcrumb={
          <nav aria-label={t.blog.breadcrumbLabel}>
            <ol className="flex flex-wrap items-center gap-1.5 text-theme-sm text-gray-400">
              <li className="flex items-center gap-1.5">
                <Link href={localizedPath("home", lang)} className="transition hover:text-white">
                  {t.blog.breadcrumbHome}
                </Link>
                <ChevronRight className="size-4 text-gray-500 rtl:rotate-180" aria-hidden />
              </li>
              <li className="flex items-center gap-1.5">
                <Link href={localizedPath("blog", lang)} className="transition hover:text-white">
                  {t.blog.title}
                </Link>
                <ChevronRight className="size-4 text-gray-500 rtl:rotate-180" aria-hidden />
              </li>
              <li aria-current="page" className="max-w-[16rem] truncate text-gray-200">
                {blog.title}
              </li>
            </ol>
          </nav>
        }
      >
        <div className="space-y-6">
          <YaziEtiketleri tags={blog.tags} />
          <YaziBilgisi
            yazar={authorName}
            tarih={postDate(blog)}
            tarihMetni={formatDate(postDate(blog), lang)}
            okuma={`${readingTime} ${t.blog.readingTime}`}
            ek={<BlogViewCounter slug={slug} initialCount={blog.view_count ?? 0} label={t.blog.views} />}
          />
        </div>
      </PageHero>

      {imageUrl ? (
        <div className={KAPAK_DIS}>
          <div className={KAPAK_CERCEVE}>
            <Image
              src={imageUrl}
              alt={coverAlt(blog, blog.title)}
              width={1280}
              height={720}
              preload
              className={KAPAK_GORSEL}
              sizes="(min-width: 896px) 832px, 100vw"
            />
          </div>
        </div>
      ) : null}

      {/*
        Okuma sütunu ~75 karakter: eskiden max-w-4xl + prose-lg ile satır
        yaklaşık 100 karakterdi, göz satır başını kaybediyordu.

        Geniş ekranda (xl) üç sütun: [boş | yazı | içindekiler]. Yazı ortada,
        kapak görselinin altında kalır; içindekiler sağ (Arapçada sol) boşlukta
        yapışkan durur. Daha dar ekranda yazının başında açılır kutu.
      */}
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-6 sm:py-16 xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] xl:gap-x-12 xl:px-8">
        {icindekiler.length >= ICINDEKILER_ALT_SINIR ? (
          <aside className="hidden xl:col-start-3 xl:row-start-1 xl:block">
            {/* top-32: başlığın (112px) altında 16px pay — globals.css'teki scroll-padding-top ile aynı. */}
            <div className="sticky top-32 max-h-[calc(100vh-9rem)] max-w-60 overflow-y-auto pb-4">
              <BlogToc items={icindekiler} label={t.blog.toc} />
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          {icindekiler.length >= ICINDEKILER_ALT_SINIR ? (
            <IcindekilerKutusu items={icindekiler} label={t.blog.toc} className="mb-10 xl:hidden" />
          ) : null}

          <article className={MAKALE_PROSE} dangerouslySetInnerHTML={{ __html: html }} />

          {/* Paylaş — TailAdmin üst çubuğundaki yuvarlak ikon düğmeleri. */}
          <div className="mt-12 border-t border-gray-200 pt-8">
            <p id="paylas-baslik" className="text-theme-xs font-medium tracking-wide text-gray-500 uppercase">
              {t.blog.share}
            </p>
            <div role="group" aria-labelledby="paylas-baslik" className="mt-4 flex flex-wrap gap-3">
              {paylasim.map(({ ad, href, Ikon }) => (
                <a
                  key={ad}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={ad}
                  title={ad}
                  className="flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-theme-xs transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <Ikon className="size-4" />
                </a>
              ))}
              <CopyLinkButton url={pageUrl} label={t.blog.copyLink} copiedLabel={t.blog.linkCopied} />
            </div>
          </div>

          <YazarKutusu ad={authorName} etiket={t.blog.author} bio={t.blog.authorBio} className="mt-12" />
        </div>
      </div>

      {/* İlgili yazılar */}
      {relatedBlogs.length > 0 ? (
        <Section tone="sunk" className="border-t border-gray-200">
          <Container>
            <h2 className="font-display text-center text-title-sm font-semibold tracking-tight text-gray-800">
              {t.blog.relatedPosts}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedBlogs.map((related) => (
                <BlogCard
                  key={related.id}
                  post={related}
                  lang={lang}
                  labels={{ readingTime: t.blog.readingTime, readMore: t.blog.readMore }}
                  headingLevel="h3"
                  compact
                />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <div className="flex justify-center px-5 py-12">
        <ButtonLink href={localizedPath("blog", lang)} variant="outline" startIcon={<ArrowLeft className="rtl:rotate-180" aria-hidden />}>
          {t.blog.backToBlog}
        </ButtonLink>
      </div>
    </main>
  );
}
