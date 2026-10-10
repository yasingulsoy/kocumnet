import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, SearchX } from "lucide-react";
import { fetchBlogs } from "@/lib/api";
import { StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { BlogCard } from "@/components/BlogCard";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { Container, KART_GOLGE, Section } from "@/components/ui";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { sayfaMetadata } from "@/lib/seo";
import { blogListPath, languageAlternates, readPageParam } from "@/lib/routes";

/** Sayfa başına yazı: 2 ve 3 sütunlu ızgarada son satır dolu kalsın. */
const SAYFA_BOYU = 12;

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sayfaAdi(t: Dictionary, n: number) {
  return t.blog.pageTitle.replace("{n}", String(n));
}

/*
 * Sayfalama: /blog, /blog?sayfa=2 (EN/AR: ?page=2). Eskiden yalnızca son 20
 * yazı listeleniyordu; daha eskilerine site içinden ulaşılamıyordu.
 *
 * - Kanonik adres her sayfanın kendisi (Google önerisi); 1. sayfa parametresiz.
 *   Geçersiz değer (?sayfa=abc, ?sayfa=0) 1. sayfa sayılır ve kanonik /blog.
 * - hreflang yalnızca 1. sayfada: dillerin yazıları farklı, 2. sayfaların
 *   birbirinin çevirisi değil.
 * - Son sayfanın ötesi (silinen yazılar, eski bağlantı): dostça bir boş
 *   durum + noindex,follow. Hiç yazı yoksa eskisi gibi "yakında" kutusu.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  const sayfa = readPageParam(await searchParams, lang);

  const metadata = sayfaMetadata({
    lang,
    title: sayfa > 1 ? `${t.blog.title} — ${sayfaAdi(t, sayfa)}` : t.blog.title,
    description: t.blog.metaDescription,
    path: blogListPath(lang, sayfa),
    languages: sayfa > 1 ? undefined : languageAlternates("blog"),
  });

  if (sayfa > 1) {
    // Aynı istek sayfada da yapılıyor; fetch önbelleği tek seferde karşılar.
    const { data } = await fetchBlogs({ page: sayfa, limit: SAYFA_BOYU, locale: lang });
    if (data.length === 0) return { ...metadata, robots: { index: false, follow: true } };
  }
  return metadata;
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const sayfa = readPageParam(await searchParams, lang);

  // Yalnızca bu dildeki yazılar
  const { data: blogs, pagination } = await fetchBlogs({ page: sayfa, limit: SAYFA_BOYU, locale: lang });
  const toplamSayfa = pagination?.totalPages ?? 1;
  const kapsamDisi = sayfa > 1 && blogs.length === 0;

  return (
    <main>
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="blog" />
      <PageHero
        eyebrow={sayfa > 1 ? `${t.blog.eyebrow} · ${sayfaAdi(t, sayfa)}` : t.blog.eyebrow}
        title={t.blog.title}
        description={t.blog.subtitle}
      />

      <Section>
        <Container>
          {/* Boş durumlar kitin EmptyState'i, kart içinde. */}
          {kapsamDisi ? (
            <Card className={KART_GOLGE}>
              <EmptyState
                className="py-16"
                icon={<SearchX />}
                title={t.blog.pageEmptyTitle}
                description={t.blog.pageEmptyDesc}
                action={
                  <ButtonLink href={blogListPath(lang, 1)} variant="outline">
                    {t.blog.firstPage}
                  </ButtonLink>
                }
              />
            </Card>
          ) : blogs.length === 0 ? (
            <Card className={KART_GOLGE}>
              <EmptyState className="py-16" icon={<BookOpen />} title={t.blog.emptyTitle} description={t.blog.emptyDesc} />
            </Card>
          ) : (
            <>
              <StaggerGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {blogs.map((blog) => (
                  <StaggerItem key={blog.id} className="h-full">
                    <BlogCard
                      post={blog}
                      lang={lang}
                      labels={{ readingTime: t.blog.readingTime, readMore: t.blog.readMore }}
                    />
                  </StaggerItem>
                ))}
              </StaggerGroup>
              <BlogPagination lang={lang} t={t} mevcut={sayfa} toplam={toplamSayfa} />
            </>
          )}
        </Container>
      </Section>
    </main>
  );
}

/** Kitin sayfalaması: bağlantılar (?sayfa=), telefonda "s / N", oklar RTL'de döner. */
function BlogPagination({ lang, t, mevcut, toplam }: { lang: Locale; t: Dictionary; mevcut: number; toplam: number }) {
  return (
    <div className="mt-12">
      <Pagination
        currentPage={mevcut}
        totalPages={toplam}
        href={(n) => blogListPath(lang, n)}
        labels={{
          nav: t.blog.paginationLabel,
          previous: t.blog.prevPage,
          next: t.blog.nextPage,
          page: (n) => sayfaAdi(t, n),
        }}
      />
    </div>
  );
}
