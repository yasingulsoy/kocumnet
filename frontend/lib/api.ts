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

export async function fetchBlogs(params?: {
  page?: number;
  limit?: number;
  /** Verilirse yalnızca o dildeki yazılar döner (backend ?locale=). */
  locale?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.locale) searchParams.set("locale", params.locale);

  const url = `${BACKEND_URL}/api/blogs?${searchParams.toString()}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return { success: false, data: [], pagination: null };
    return res.json();
  } catch {
    return { success: false, data: [], pagination: null };
  }
}

export async function fetchBlogBySlug(slug: string) {
  const url = `${BACKEND_URL}/api/blogs/slug/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const result = await res.json();
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BACKEND_URL}${path}`;
}
