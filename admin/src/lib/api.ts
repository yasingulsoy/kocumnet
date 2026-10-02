/**
 * Tarayıcıdan backend'e (api.kocum.net) giden istekler — yalnızca kimlik
 * işlemleri için: giriş, çıkış. Check-up verisi sunucuda, doğrudan
 * veritabanından okunur (lib/checkup/*); backend'e tarayıcıdan veri isteği
 * kalmadı.
 *
 * Eskiden burada 470 satır vardı: blog/kullanıcı CRUD sarmalayıcıları ve
 * backend'de hiç var olmayan /api/files uç noktalarına giden ölü yükleme
 * kodu. Site yönetimi kocum.net/admin'e taşındı; burası sadeleşti.
 */

const getApiUrl = () => {
  const url =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL;

  const v = (url || "").trim();
  if (!v) {
    throw new Error(
      "Eksik environment değişkeni: NEXT_PUBLIC_BACKEND_URL. " +
        "Dokploy/Nixpacks build için Build Environment Variables'a ekleyin (örnek: https://api.kocum.net)"
    );
  }
  return v.replace(/\/$/, "");
};

export const API_URL = getApiUrl();

/**
 * Tarayıcıda API isteği adresi. Üretim: doğrudan backend; geliştirme: Next
 * rewrite (/api-backend) — HttpOnly çerez aynı kökene düşsün diye.
 */
export function getApiFetchUrl(endpoint: string): string {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const isDevBrowser = typeof window !== "undefined" && process.env.NODE_ENV === "development";
  return isDevBrowser ? `/api-backend${path}` : `${API_URL}${path}`;
}

const CSRF_MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfTokenCache: string | null = null;
let csrfInflight: Promise<string> | null = null;

export function clearCsrfTokenCache(): void {
  csrfTokenCache = null;
}

/** Çift gönderim CSRF: backend çerezi koyar, biz aynı değeri başlıkta yollarız. */
export async function getCsrfToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (csrfTokenCache) return csrfTokenCache;
  if (!csrfInflight) {
    csrfInflight = (async () => {
      const r = await fetch(getApiFetchUrl("/api/csrf-token"), {
        method: "GET",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`CSRF token alınamadı (${r.status})`);
      const j = (await r.json()) as { csrfToken?: string };
      if (!j?.csrfToken || typeof j.csrfToken !== "string") {
        throw new Error("Geçersiz CSRF yanıtı");
      }
      return j.csrfToken;
    })();
  }
  try {
    const tok = await csrfInflight;
    csrfTokenCache = tok;
    return tok;
  } finally {
    csrfInflight = null;
  }
}

export async function mergeCsrfInit(init: RequestInit = {}): Promise<RequestInit> {
  if (typeof window === "undefined") return init;
  const method = (init.method || "GET").toUpperCase();
  if (!CSRF_MUTATING.has(method)) return init;
  const token = await getCsrfToken();
  const headers = new Headers(init.headers as HeadersInit);
  headers.set("X-CSRF-Token", token);
  return { ...init, headers, credentials: "include" };
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * Giriş: backend `admin_access_token` HttpOnly çerezini koyar. Başarılıysa
 * sayfa tam yenilenir ki sunucu bileşenleri çerezi görsün.
 */
export async function loginRequest(usernameOrEmail: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(
      getApiFetchUrl("/api/admin/auth/login"),
      await mergeCsrfInit({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password }),
      })
    );
  } catch {
    return { ok: false, error: "Sunucuya ulaşılamadı. Bağlantını kontrol et." };
  }

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    message?: string;
    code?: string;
  };

  if (res.status === 429) {
    return { ok: false, error: "Çok fazla deneme. 15 dakika sonra tekrar dene." };
  }
  if (res.status === 403 && data.code === "CSRF_FAILED") {
    // Çerez süresi dolmuş olabilir; bir kez yenile ve çağırana tekrar denetsin.
    clearCsrfTokenCache();
    return { ok: false, error: "Oturum güvenlik anahtarı yenilendi, tekrar dene." };
  }
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || data.message || "E-posta veya parola hatalı." };
  }
  return { ok: true };
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch(getApiFetchUrl("/api/admin/auth/logout"), await mergeCsrfInit({ method: "POST" }));
  } catch {
    // Çerez zaten düşmüş olabilir; yönlendirme yine de yapılır.
  }
  clearCsrfTokenCache();
}
