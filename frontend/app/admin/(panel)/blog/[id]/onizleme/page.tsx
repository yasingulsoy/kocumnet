import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, ExternalLink, History } from "lucide-react";
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
import { PageHero } from "@/components/PageHero";
import { ActionButton } from "@/components/admin/ActionButtons";
import { trDate } from "@/components/admin/ui";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink, buttonClass } from "@/components/tailadmin/ui/Button";
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
        <nav aria-label="Konum" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm">
            <li className="flex items-center gap-1.5">
              <Link href="/admin/blog" className="text-gray-500 transition hover:text-brand-500">
                Blog
              </Link>
              <ChevronRight className="size-4 text-gray-400 rtl:rotate-180" aria-hidden />
            </li>
            <li className="flex min-w-0 items-center gap-1.5">
              <Link href={`/admin/blog/${blog.id}`} className="max-w-[16rem] truncate text-gray-500 transition hover:text-brand-500">
                {blog.title}
              </Link>
              <ChevronRight className="size-4 text-gray-400 rtl:rotate-180" aria-hidden />
            </li>
            <li aria-current="page" className="font-medium text-gray-800">
              Önizleme
            </li>
            <li>
              <Badge size="sm" color={blog.is_published ? "success" : "warning"} className="ms-1">
                {blog.is_published ? "Yayında" : "Taslak"}
              </Badge>
            </li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {surum && yazar ? (
            <ActionButton
              action={restoreRevisionAction.bind(null, blog.id, surum.id, blog.updated_at)}
              variant="soft"
              icon={<History aria-hidden />}
              confirm={{
                title: "Yazı bu sürüme dönsün mü?",
                description:
                  "Başlık, içerik, özet, meta alanları ve etiketler değişir; adres ve yayın durumu aynı kalır. Editörde kaydedilmemiş değişiklik varsa kaybolur.",
                confirmLabel: "Bu sürüme dön",
                tone: "warning",
              }}
            >
              Bu sürüme dön
            </ActionButton>
          ) : null}
          {blog.is_published && !surum ? (
            <a href={`${getSiteUrl()}${adres}`} target="_blank" rel="noopener" className={buttonClass({ variant: "outline", size: "xs" })}>
              Sitede aç <ExternalLink aria-hidden />
            </a>
          ) : null}
          <ButtonLink href={`/admin/blog/${blog.id}`} size="xs" startIcon={<ArrowLeft className="rtl:rotate-180" aria-hidden />}>
            Düzenlemeye dön
          </ButtonLink>
        </div>
      </div>

      <Alert variant="info" className="mb-5">
        {surum
          ? `${trDate(surum.created_at, { time: true })} tarihli sürüm${personName(surum.author) ? ` (${personName(surum.author)})` : ""}. Kapak ve adres yazının şu anki hâlinden.`
          : blog.is_published
            ? "Yazının kayıtlı hâli; sitede de böyle görünüyor."
            : "Taslak: sitede görünmez. Önizleme son kaydedilen hâli gösterir; editörde kaydedilmemiş değişiklikler burada yok."}
      </Alert>

      {/*
        Tarayıcı çerçevesi: okurun göreceği sayfa, sitenin adresiyle. Çerçevenin
        içi BİLEREK sitenin kendi makale parçaları (PageHero ve
        components/BlogArticle — sitedeki yazı sayfası da onları kullanır):
        önizleme sitedeki görünümle aynı kalsın.
      */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-bg shadow-theme-md">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-gray-300" />
            <span className="size-2.5 rounded-full bg-gray-300" />
            <span className="size-2.5 rounded-full bg-gray-300" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-1 text-theme-xs text-gray-600 ring-1 ring-gray-200 ring-inset">
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
              <p className="flex flex-wrap items-center gap-1.5 text-theme-sm text-gray-400">
                <span>{t.blog.breadcrumbHome}</span>
                <ChevronRight className="size-4 text-gray-500 rtl:rotate-180" aria-hidden />
                <span>{t.blog.title}</span>
                <ChevronRight className="size-4 text-gray-500 rtl:rotate-180" aria-hidden />
                <span className="max-w-[16rem] truncate text-gray-200">{yazi.title}</span>
              </p>
            }
          >
            <div className="space-y-6">
              <YaziEtiketleri tags={yazi.tags} />
              <YaziBilgisi
                yazar={yazarAdi}
                tarih={postDate(yazi)}
                tarihMetni={formatDate(postDate(yazi), dil)}
                okuma={`${readingMinutes(yazi)} ${t.blog.readingTime}`}
              />
            </div>
          </PageHero>

          {kapak ? (
            <div className={KAPAK_DIS}>
              <div className={KAPAK_CERCEVE}>
                {/* eslint-disable-next-line @next/next/no-img-element -- yönetim önizlemesi; backend görseli, next/image uzak adres ayarına bağlı kalmasın */}
                <img src={kapak} alt={yazi.image_alt || yazi.title} width={1280} height={720} className={KAPAK_GORSEL} />
              </div>
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
            {icindekiler.length >= ICINDEKILER_ALT_SINIR ? (
              <IcindekilerKutusu items={icindekiler} label={t.blog.toc} className="mb-10" />
            ) : null}

            {html ? (
              <article className={MAKALE_PROSE} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className="text-base text-gray-500 italic">Bu yazının henüz içeriği yok.</p>
            )}

            <YazarKutusu ad={yazarAdi} etiket={t.blog.author} bio={t.blog.authorBio} className="mt-12" />
          </div>
        </div>
      </div>
    </>
  );
}
