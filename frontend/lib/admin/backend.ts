import "server-only";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

/**
 * Site yönetiminin backend köprüsü (BFF).
 *
 * Tarayıcı api.kocum.net ile HİÇ konuşmaz: her istek bu sunucudan çıkar.
 * Böylece
 *  · CORS ve çapraz alan çerez dertleri yok,
 *  · backend adresi istemciye inmez,
 *  · CSRF çift gönderimi burada tek yerde çözülür.
 *
 * Oturum: backend'in verdiği `admin_access_token` JWT'si, bu sunucunun kendi
 * çerezi olarak tarayıcıya yazılır (lib/admin/auth.ts) ve her istekte
 * backend'e `cookie:` başlığıyla taşınır. Check-up paneli (admin.kocum.net)
 * aynı çerez adını kullanır; AUTH_COOKIE_DOMAIN=.kocum.net ile tek giriş.
 */

export const ADMIN_COOKIE = "admin_access_token";
const CSRF_COOKIE = "csrf_token";
const TIMEOUT_MS = 15_000;

export class BackendError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  constructor(message: string, status: number, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Backend'e ulaşılamadı (ağ, zaman aşımı, 5xx). Oturum hatası DEĞİL. */
export class BackendUnreachable extends Error {
  constructor(detail: string) {
    super("Backend'e ulaşılamadı: " + detail);
    this.name = "BackendUnreachable";
  }
}

interface Istek {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** multipart (kapak yükleme) — body ile birlikte verilmez. */
  formData?: FormData;
  /** Oturum çerezini taşı (varsayılan: evet). Giriş/parola uçlarında kapatılır. */
  auth?: boolean;
}

/**
 * CSRF çift gönderimi: backend'den jeton alır, aynı değeri hem çerez hem
 * başlık olarak yollarız. Sunucu-sunucu çağrısında bu zararsızdır — korunan
 * şey tarayıcıdaki oturumla istemsiz istek; burada tarayıcı yok.
 */
async function csrf(): Promise<{ cookie: string; header: string }> {
  const res = await fetch(`${BACKEND_URL}/api/csrf-token`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new BackendUnreachable(`csrf ${res.status}`);
  const j = (await res.json()) as { csrfToken?: string };
  if (!j.csrfToken) throw new BackendUnreachable("csrf yanıtı boş");
  return { cookie: `${CSRF_COOKIE}=${j.csrfToken}`, header: j.csrfToken };
}

/** Ham yanıt: giriş gibi Set-Cookie okunması gereken yerler için. */
export async function backendRaw(path: string, istek: Istek = {}): Promise<{ res: Response; json: Record<string, unknown> | null }> {
  const method = istek.method ?? "GET";
  const headers = new Headers();
  const cerezler: string[] = [];

  if (istek.auth !== false) {
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (token) cerezler.push(`${ADMIN_COOKIE}=${encodeURIComponent(token)}`);
  }
  if (method !== "GET") {
    const c = await csrf();
    cerezler.push(c.cookie);
    headers.set("x-csrf-token", c.header);
  }
  if (cerezler.length) headers.set("cookie", cerezler.join("; "));

  let body: BodyInit | undefined;
  if (istek.formData) {
    body = istek.formData;
  } else if (istek.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(istek.body);
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new BackendUnreachable((e as Error).message);
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status >= 500) {
    throw new BackendUnreachable(`${res.status} ${String(json?.error ?? "")}`.trim());
  }
  return { res, json };
}

/**
 * JSON çağrısı. Başarısız yanıtı BackendError olarak fırlatır (durum kodu,
 * backend'in kodu ve varsa alan hataları ile) — çağıran form, mesajı
 * kullanıcıya olduğu gibi gösterebilir: backend hataları Türkçe ve kibar.
 */
export async function backend<T = Record<string, unknown>>(path: string, istek: Istek = {}): Promise<T> {
  const { res, json } = await backendRaw(path, istek);
  if (!res.ok || (json && json.success === false)) {
    throw new BackendError(
      String(json?.error ?? json?.message ?? `İstek başarısız (${res.status})`),
      res.status,
      typeof json?.code === "string" ? json.code : undefined,
      (json?.fields as Record<string, string> | undefined) ?? undefined
    );
  }
  return (json ?? {}) as T;
}

/** Set-Cookie satırlarından oturum jetonunu çeker. */
export function oturumJetonu(res: Response): string | null {
  const satirlar = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const satir of satirlar) {
    const [cift] = satir.split(";");
    const i = cift.indexOf("=");
    if (i > 0 && cift.slice(0, i).trim() === ADMIN_COOKIE) {
      const deger = cift.slice(i + 1).trim();
      return deger ? decodeURIComponent(deger) : null;
    }
  }
  return null;
}
