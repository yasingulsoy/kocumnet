import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, ExternalLink, History } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { ActionButton } from "@/components/admin/ActionButtons";
import { Notice, Pill, buttonClass, trDate } from "@/components/admin/ui";
import { restoreRevisionAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getBlog, getRevision } from "@/lib/admin/data";
import { CONTENT_ROLES, personName, type AdminBlog, type BlogRevision } from "@/lib/admin/types";
import { BACKEND_URL, getImageUrl } from "@/lib/api";
import { authorName, formatDate, postDate, readingMinutes } from "@/lib/blog";
import { blogIceriginiHazirla, ICINDEKILER_ALT_SINIR } from "@/lib/blog-content";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALE_DIR, isLocale, type Locale } from "@/lib/i18n/config";
import { blogPath } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Önizleme" };

/**
 * Yazı önizlemesi — sitedeki makale görünümü, yönetimin içinde.
 *
 * Taslak sitede açılmadığı için yazar yazısının okura nasıl görüneceğini
 * yayınlamadan göremiyordu. Bu sayfa sitenin makale parçalarını SALT OKUNUR
 * kullanır (PageHero, içerik hazırlama, sözlük, tarih/okuma süresi) ve
 * gövdeyi blog detay sayfasıyla aynı sınıflarla çizer. Görüntülenme sayacı,
 * paylaşım ve ilgili yazılar yok: önizleme sayaç artırmasın, siteye gitmesin.
 *
 * `?surum=<id>`: yazının o sürümünü gösterir (sürüm geçmişi).
 */
export default async function OnizlemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { staff } = await requireStaff(undefined, `/admin/blog/${encodeURIComponent(id)}/onizleme`);
  const yazar = CONTENT_ROLES.includes(staff.role);
  const sayi = Number(id);
  if (!Number.isInteger(sayi) || sayi <= 0) notFound();

  const sp = await searchParams;
  const surumId = typeof sp.surum === "string" ? Number(sp.surum) : NaN;

  let blog: AdminBlog;
  let surum: BlogRevision | null = null;
  try {
    blog = await getBlog(sayi);
    if (Number.isInteger(surumId) && surumId > 0) surum = await getRevision(sayi, surumId);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // Görünen yazı: sürüm seçildiyse metin alanları o sürümden.
  const yazi: AdminBlog = surum
    ? {
        ...blog,
        title: surum.title,
        content: surum.content,
        excerpt: surum.excerpt,
        tags: surum.tags,
        meta_title: surum.meta_title,
        meta_description: surum.meta_description,
        image_alt: surum.image_alt,
      }
    : blog;

  const dil: Locale = isLocale(blog.locale) ? blog.locale : "tr";
  const t = await getDictionary(dil);
  const { html, icindekiler } = blogIceriginiHazirla(yazi.content, BACKEND_URL);
  const kapak = getImageUrl(yazi.image);
  const yazarAdi = authorName(yazi) ?? "Koçum.Net";
  const adres = blogPath(blog.slug, dil);
  const siteAdresi = getSiteUrl().replace(/^https?:\/\//, "");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Konum" className="flex min-w-0 flex-wrap items-center gap-1.5 text-caption text-ink-faint">
          <Link href="/admin/blog" className="transition hover:text-brand">Blog</Link>
          <span aria-hidden>/</span>
          <Link href={`/admin/blog/${blog.id}`} className="max-w-[16rem] truncate transition hover:text-brand">
            {blog.title}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink">Önizleme</span>
          <Pill tone={blog.is_published ? "ok" : "warn"} className="ms-1">{blog.is_published ? "Yayında" : "Taslak"}</Pill>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {surum && yazar ? (
            <ActionButton
              action={restoreRevisionAction.bind(null, blog.id, surum.id)}
              variant="soft"
              size="sm"
              confirm="Yazı bu sürüme dönsün mü? Başlık, içerik, özet, meta alanları ve etiketler değişir; adres ve yayın durumu aynı kalır. Editörde kaydedilmemiş değişiklik varsa kaybolur."
            >
              <History /> Bu sürüme dön
            </ActionButton>
          ) : null}
          {blog.is_published && !surum ? (
            <a href={`${getSiteUrl()}${adres}`} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary", size: "sm" })}>
              Sitede aç <ExternalLink />
            </a>
          ) : null}
          <Link href={`/admin/blog/${blog.id}`} className={buttonClass({ size: "sm" })}>
            <ArrowLeft /> Düzenlemeye dön
          </Link>
        </div>
      </div>

      <Notice tone="info" className="mb-5">
        {surum
          ? `${trDate(surum.created_at, { time: true })} tarihli sürüm${personName(surum.author) ? ` (${personName(surum.author)})` : ""}. Kapak ve adres yazının şu anki hâlinden.`
          : blog.is_published
            ? "Yazının kayıtlı hâli; sitede de böyle görünüyor."
            : "Taslak: sitede görünmez. Önizleme son kaydedilen hâli gösterir; editörde kaydedilmemiş değişiklikler burada yok."}
      </Notice>

      {/* Tarayıcı çerçevesi: okurun göreceği sayfa, sitenin adresiyle. */}
      <div className="overflow-hidden rounded-2xl border border-line-strong bg-bg shadow-raised">
        <div className="flex items-center gap-3 border-b border-line bg-surface-sunk px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-1 text-micro text-ink-soft ring-1 ring-inset ring-line">
            {siteAdresi}
            {adres}
          </span>
        </div>

        <div lang={dil} dir={LOCALE_DIR[dil]}>
          <PageHero
            tone="deep"
            title={yazi.title}
            description={yazi.excerpt ?? undefined}
            breadcrumb={
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-white/70">
                <span>{t.blog.breadcrumbHome}</span>
                <span aria-hidden>/</span>
                <span>{t.blog.title}</span>
                <span aria-hidden>/</span>
                <span className="max-w-[16rem] truncate text-white/85">{yazi.title}</span>
              </p>
            }
          >
            <div className="space-y-6">
              {yazi.tags && yazi.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {yazi.tags.map((etiket) => (
                    <li key={etiket} className="rounded-full bg-white/15 px-3 py-1 text-micro font-semibold uppercase tracking-wider text-white">
                      {etiket}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-white/70">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-white/20 text-caption font-bold text-white">
                    {yazarAdi.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-white/85">{yazarAdi}</span>
                </span>
                <span className="size-1 rounded-full bg-white/30" aria-hidden />
                <time dateTime={postDate(yazi)}>{formatDate(postDate(yazi), dil)}</time>
                <span className="size-1 rounded-full bg-white/30" aria-hidden />
                <span>
                  {readingMinutes(yazi)} {t.blog.readingTime}
                </span>
              </div>
            </div>
          </PageHero>

          {kapak ? (
            <div className="mx-auto w-full max-w-4xl px-5 sm:px-6">
              <div className="relative -mt-12 overflow-hidden rounded-2xl shadow-pop sm:-mt-16">
                {/* eslint-disable-next-line @next/next/no-img-element -- yönetim önizlemesi; backend görseli, next/image uzak adres ayarına bağlı kalmasın */}
                <img src={kapak} alt={yazi.image_alt || yazi.title} width={1280} height={720} className="h-auto w-full object-cover" />
              </div>
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
            {icindekiler.length >= ICINDEKILER_ALT_SINIR ? (
              <nav aria-label={t.blog.toc} className="mb-10 rounded-2xl border border-line bg-surface-sunk">
                <details open className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-micro font-semibold uppercase tracking-[0.18em] text-brand [&::-webkit-details-marker]:hidden">
                    {t.blog.toc}
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ol className="space-y-2 border-t border-line px-5 py-4 text-body">
                    {icindekiler.map((oge) => (
                      <li key={oge.id} className={oge.seviye === 3 ? "ps-4 text-caption" : undefined}>
                        <a href={`#${oge.id}`} className="text-ink-soft underline-offset-4 transition hover:text-brand hover:underline">
                          {oge.metin}
                        </a>
                      </li>
                    ))}
                  </ol>
                </details>
              </nav>
            ) : null}

            {html ? (
              <article
                className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-ink prose-p:text-ink-soft prose-p:leading-relaxed prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-strong:text-ink prose-blockquote:border-s-brand prose-blockquote:text-ink-soft"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="text-body italic text-ink-faint">Bu yazının henüz içeriği yok.</p>
            )}

            <div className="mt-12 rounded-2xl border border-line bg-surface-sunk p-6 sm:p-8">
              <div className="flex items-start gap-5">
                <span
                  aria-hidden
                  className="font-display flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-h4 font-semibold text-white shadow-raised"
                >
                  {yazarAdi.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.18em] text-brand">{t.blog.author}</p>
                  <p className="font-display mt-1 text-h4 font-semibold text-ink">{yazarAdi}</p>
                  <p className="mt-2 text-caption text-ink-soft">{t.blog.authorBio}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
