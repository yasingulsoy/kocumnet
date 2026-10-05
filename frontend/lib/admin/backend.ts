import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";
import { istemciIp } from "./client-ip";

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

/**
 * Backend'e ulaşılamadı (ağ, zaman aşımı) ya da beklenmeyen bir 5xx verdi.
 * Oturum hatası DEĞİL. `status` varsa sunucu yanıt verdi ama hata oluştu;
 * `requestId` backend günlüğündeki satırla eşleşir.
 */
export class BackendUnreachable extends Error {
  status?: number;
  requestId?: string;
  constructor(detail: string, status?: number, requestId?: string) {
    super("Backend'e ulaşılamadı: " + detail);
    this.name = "BackendUnreachable";
    this.status = status;
    this.requestId = requestId;
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
 * CSRF çift gönderimi: backend yalnızca çerezdeki jetonla başlıktakinin AYNI
 * ve biçimce geçerli (64 hex) olmasına bakar. Jetonu burada üretip ikisine de
 * koyuyoruz — eskiden her yazma işleminden önce backend'den jeton istemek
 * için fazladan bir gidiş-dönüş yapılıyordu. Sunucu-sunucu çağrısında bu
 * zararsızdır: korunan şey tarayıcıdaki oturumla istemsiz istek; burada
 * tarayıcı yok, çerez de tarayıcıya hiç inmiyor.
 */
function csrf(): { cookie: string; header: string } {
  const jeton = randomBytes(32).toString("hex");
  return { cookie: `${CSRF_COOKIE}=${jeton}`, header: jeton };
}

/**
 * Gerçek istemci IP'si, ortak sırla imzalı (backend: middleware/clientIp.js).
 *
 * Backend bütün site yönetimi isteklerini bu sunucunun TEK IP'sinden görür;
 * IP'ye göre sayılan sınırlar (giriş denemeleri gibi) bu yüzden herkes için
 * ortak kovaydı. BFF_SHARED_SECRET iki tarafta da tanımlıysa tarayıcının
 * IP'sini HMAC ile imzalayıp gönderiyoruz; sır ağda dolaşmaz. Tanımlı
 * değilse hiçbir şey eklenmez (eski davranış).
 *
 * IP'nin nereden okunduğu: lib/admin/client-ip.ts.
 */
const BFF_SIRRI = (process.env.BFF_SHARED_SECRET ?? "").trim();
const BFF_AKTIF = BFF_SIRRI.length >= 32;

async function istemciImzasi(): Promise<Record<string, string> | null> {
  if (!BFF_AKTIF) return null;
  const ip = await istemciIp();
  if (!ip) return null;
  const zaman = String(Date.now());
  const imza = createHmac("sha256", BFF_SIRRI).update(`${ip}|${zaman}`).digest("hex");
  return { "x-bff-client-ip": ip, "x-bff-time": zaman, "x-bff-signature": imza };
}

/**
 * 5xx'in "beklenen" olanları: backend bilerek döndürüyor ve kullanıcıya
 * söylenecek bir şey var (ör. "e-posta gönderimi kapalı"). Eskiden her 5xx
 * "sunucuya ulaşılamadı"ya dönüşüyordu; parolamı unuttum ekranı SMTP
 * kapalıyken bu yüzden yanlış mesaj gösteriyordu.
 */
const BEKLENEN_5XX = new Set(["MAIL_NOT_CONFIGURED", "MAIL_SEND_FAILED"]);

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
    const c = csrf();
    cerezler.push(c.cookie);
    headers.set("x-csrf-token", c.header);
  }
  if (cerezler.length) headers.set("cookie", cerezler.join("; "));
  // Backend günlüğündeki satırla eşleşsin diye (middleware/requestLogger.js).
  const istekKimligi = randomBytes(6).toString("hex");
  headers.set("x-request-id", istekKimligi);
  const imzali = await istemciImzasi();
  if (imzali) for (const [ad, deger] of Object.entries(imzali)) headers.set(ad, deger);

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
    throw new BackendUnreachable(`${(e as Error).message} [${istekKimligi}]`, undefined, istekKimligi);
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status >= 500 && !(typeof json?.code === "string" && BEKLENEN_5XX.has(json.code))) {
    // Sorgu dizesi günlüğe yazılmaz: arama kutusundaki e-posta/ad kişisel veri.
    console.error(`[admin] backend ${res.status} ${method} ${path.split("?")[0]} [${istekKimligi}]`);
    throw new BackendUnreachable(`${res.status} ${String(json?.error ?? "")} [${istekKimligi}]`.trim(), res.status, istekKimligi);
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
