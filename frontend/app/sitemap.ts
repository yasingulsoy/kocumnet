import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { blogPath, languageAlternates, localizedPath, ROUTE_KEYS } from "@/lib/routes";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://127.0.0.1:5000";

async function getPublishedBlogs(locale: Locale) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/blogs?limit=100&locale=${locale}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.success ? data.data : [];
  } catch {
    return [];
  }
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
        return blogs.map((blog: any) => ({
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
