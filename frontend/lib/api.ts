import type { BlogPost } from "@/lib/blog";

/**
 * Backend'e giden tek kapı.
 *
 * ⚠️ BACKEND_URL'i başka dosyada yeniden tanımlama. Eskiden üç ayrı yerde
 * (burası, BlogViewCounter, sitemap) ayrı ayrı tanımlıydı ve env yedek
 * zincirleri birbirinden farklıydı — biri çalışırken öteki localhost'a
 * düşüyordu. Sunucu tarafı her yerden burayı kullanır; istemci tarafı
 * yalnızca NEXT_PUBLIC_* okuyabildiği için PUBLIC_BACKEND_URL'i kullanır.
 */
const getBackendUrl = (): string => {
  const url =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    "http://127.0.0.1:5000";
  return url.replace(/\/$/, "");
};

export const BACKEND_URL = getBackendUrl();

/**
 * İstemci bileşenlerinin kullanabileceği adres.
 *
 * Tarayıcıya yalnızca NEXT_PUBLIC_* ile başlayanlar iner ve bunlar DERLEME
 * anında gömülür — runtime'da set etmek işe yaramaz (bkz. DEPLOY.md).
 */
export const PUBLIC_BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

interface BlogListResponse {
  success: boolean;
  data: BlogPost[];
  pagination: { page: number; limit: number; total: number; pages: number } | null;
}

export async function fetchBlogs(params?: {
  page?: number;
  limit?: number;
  /** Verilirse yalnızca o dildeki yazılar döner (backend ?locale=). */
  locale?: string;
}): Promise<BlogListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.locale) searchParams.set("locale", params.locale);

  const url = `${BACKEND_URL}/api/blogs?${searchParams.toString()}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return { success: false, data: [], pagination: null };
    const json = (await res.json()) as Partial<BlogListResponse>;
    // Backend beklenmedik bir şey dönerse sayfa çökmesin.
    return {
      success: Boolean(json.success),
      data: Array.isArray(json.data) ? json.data : [],
      pagination: json.pagination ?? null,
    };
  } catch {
    return { success: false, data: [], pagination: null };
  }
}

export async function fetchBlogBySlug(slug: string): Promise<BlogPost | null> {
  const url = `${BACKEND_URL}/api/blogs/slug/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const result = (await res.json()) as { success?: boolean; data?: BlogPost };
    return result.success && result.data ? result.data : null;
  } catch {
    return null;
  }
}

export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BACKEND_URL}${path}`;
}
