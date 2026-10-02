import { LOCALE_INTL, type Locale } from "@/lib/i18n/config";

/**
 * Blog verisinin tipi ve ortak yardımcıları.
 *
 * Neden var: blog yazısı dört ayrı dosyada `any` olarak dolaşıyordu
 * (blog listesi, blog detayı, sitemap, llms.txt). Backend bir alanın adını
 * değiştirdiğinde TypeScript hiçbir şey demiyor, sayfa sessizce boş
 * render ediliyordu. `estimateReadingTime` ve `formatDate` de iki dosyada
 * birebir kopyaydı.
 */

/** Backend'in `/api/blogs` yanıtındaki yazı. */
export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Yalnızca detay yanıtında dolu gelir; liste yanıtında yok. */
  content?: string | null;
  image: string | null;
  tags: string[] | null;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  view_count: number | null;
  meta_title: string | null;
  meta_description: string | null;
  /** Liste yanıtında içerik gönderilmiyor, uzunluğu gönderiliyor. */
  content_length?: number | null;
  author?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

/** Yazının yayın tarihi — yayınlanmadıysa oluşturulma tarihine düşer. */
export function postDate(post: BlogPost): string {
  return post.published_at ?? post.created_at;
}

export function formatDate(dateString: string, locale: Locale): string {
  return new Date(dateString).toLocaleDateString(LOCALE_INTL[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Okuma süresi (dakika).
 *
 * Liste sayfasında `content` gelmiyor; backend `content_length` gönderiyor.
 * İkisinden hangisi varsa ondan hesaplıyoruz — eskiden liste sayfası
 * `excerpt` üzerinden hesapladığı için her yazıya "1 dk" yazıyordu.
 */
export function readingMinutes(post: BlogPost): number {
  if (typeof post.content === "string" && post.content.length > 0) {
    const text = post.content.replace(/<[^>]*>/g, "");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }
  if (typeof post.content_length === "number" && post.content_length > 0) {
    // Ortalama 6 karakter/kelime, 200 kelime/dakika.
    return Math.max(1, Math.ceil(post.content_length / 6 / 200));
  }
  return 1;
}

export function authorName(post: BlogPost): string | null {
  const ad = [post.author?.first_name, post.author?.last_name].filter(Boolean).join(" ").trim();
  return ad.length > 0 ? ad : null;
}
