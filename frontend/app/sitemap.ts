import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { blogPath, languageAlternates, localizedPath, ROUTE_KEYS } from "@/lib/routes";
// Backend'e tek kapı lib/api.ts (adres ve hata yönetimi orada).
import { fetchBlogs } from "@/lib/api";
import type { BlogPost } from "@/lib/blog";

/** Backend sayfa başına en fazla 100 yazı veriyor. */
const SAYFA = 100;
/** Güvenlik tavanı: 2.000 yazı/dil — sitemap tek dosyada 50.000 URL'ye kadar çıkabilir. */
const EN_FAZLA_SAYFA = 20;

/**
 * Bir dilin yayındaki BÜTÜN yazıları. Eskiden tek istek (limit=100) atılıyordu:
 * 100. yazıdan sonrası sitemap'e hiç girmiyordu. Backend kapalıysa boş döner,
 * derleme çökmez.
 */
async function getPublishedBlogs(locale: Locale): Promise<BlogPost[]> {
  const ilk = await fetchBlogs({ page: 1, limit: SAYFA, locale, revalidate: 3600 });
  const toplam = Math.min(ilk.pagination?.totalPages ?? 1, EN_FAZLA_SAYFA);
  const kalan = await Promise.all(
    Array.from({ length: Math.max(0, toplam - 1) }, (_, i) =>
      fetchBlogs({ page: i + 2, limit: SAYFA, locale, revalidate: 3600 })
    )
  );
  return [ilk, ...kalan].flatMap((sonuc) => sonuc.data);
}

/** Göreli yolları tam URL'ye çevirir (hreflang alternates dahil). */
function absolutise(base: string, paths: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, `${base}${v}`]));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const lastModified = new Date();

  // Statik sayfalar — her dil için ayrı giriş + hreflang alternates
  const staticEntries: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    ROUTE_KEYS.map((key) => ({
      url: `${base}${localizedPath(key, locale)}`,
      lastModified,
      changeFrequency:
        key === "home" ? ("weekly" as const) : key === "blog" ? ("daily" as const) : ("monthly" as const),
      priority: key === "home" ? 1 : key === "blog" ? 0.9 : 0.8,
      alternates: { languages: absolutise(base, languageAlternates(key)) },
    }))
  );

  // Blog yazıları — dile göre
  const blogEntries: MetadataRoute.Sitemap = (
    await Promise.all(
      LOCALES.map(async (locale) => {
        const blogs = await getPublishedBlogs(locale);
        return blogs.map((blog) => ({
          url: `${base}${blogPath(blog.slug, locale)}`,
          lastModified: new Date(blog.updated_at || blog.created_at),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
      })
    )
  ).flat();

  return [...staticEntries, ...blogEntries];
}
