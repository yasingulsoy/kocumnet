import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { istemciIp } from "./istemci-ip";

/**
 * Backend köprüsü (BFF). Tarayıcı backend'le hiç konuşmaz; her istek bu
 * sunucudan `${BACKEND_URL}/api` adresine gider (checkup/API.md):
 *
 *   x-servis-anahtari   her istekte (SERVIS_ANAHTARI)
 *   x-istemci-ip        tarayıcının IP'si (backend hız sınırları için)
 *   Authorization       oturum çerezi varsa `Bearer <jeton>`
 *
 * Hata biçimi `{ hata: { kod, mesaj, alanlar?, ek? } }` tipli sonuca çevrilir.
 * OTURUM_YOK gelirse çerez silinir ve girişe gidilir (bkz. oturumuSonlandir).
 */

export const OTURUM_CEREZI = "yonetici_oturum";
/** Backend jetonuyla aynı: 12 saat. */
export const OTURUM_SURESI_SN = 12 * 60 * 60;
const ZAMAN_ASIMI_MS = 30_000;

export interface ApiHatasi {
  kod: string;
  mesaj: string;
  alanlar?: Record<string, string>;
  ek?: unknown;
  /** HTTP durum kodu; bağlantı hatasında 0. */
  durum: number;
}

export type ApiSonucu<T> = { ok: true; veri: T; durum: number } | { ok: false; hata: ApiHatasi };

export type Yontem = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface IstekSecenekleri {
  method?: Yontem;
  /** JSON gövde. */
  govde?: unknown;
  /** multipart gövde (görsel, Excel); `govde` ile birlikte verilmez. */
  formData?: FormData;
  /** Oturum jetonunu taşı (varsayılan evet). Girişte kapatılır. */
  oturum?: boolean;
  /**
   * OTURUM_YOK gelince ne olsun: "yonlendir" (varsayılan) çerezi siler ve
   * girişe gider; "dondur" hatayı çağırana bırakır (route handler, giriş).
   */
  oturumYoksa?: "yonlendir" | "dondur";
}

const MESAJLAR: Record<string, string> = {
  BAGLANTI: "Sunucuya ulaşılamadı. Birkaç saniye sonra tekrar deneyin.",
  SUNUCU: "Sunucuda beklenmeyen bir hata oluştu. Sorun sürerse teknik ekibe haber verin.",
  SERVIS_ANAHTARI: "Panel sunucusu backend'e bağlanamıyor (servis anahtarı). Teknik ekibe haber verin.",
  YETKI_YOK: "Bu işlem için yetkiniz yok. Yalnızca YÖNETİCİ rolündeki hesaplar yapabilir.",
  OTURUM_YOK: "Oturumunuz kapanmış. Lütfen yeniden giriş yapın.",
};

function tabanAdres(): string {
  const adres = (process.env.BACKEND_URL ?? "http://127.0.0.1:4000").trim().replace(/\/+$/, "");
  return `${adres}/api`;
}

async function jeton(): Promise<string | undefined> {
  try {
    return (await cookies()).get(OTURUM_CEREZI)?.value || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ham istek: yanıtı olduğu gibi döndürür (dosya aktarımı için). Ağ hatasında
 * `null` döner. Başlıkları ve kimliği ekler; gövdeyi yorumlamaz.
 */
export async function backendHam(yol: string, secenek: IstekSecenekleri = {}): Promise<Response | null> {
  const method = secenek.method ?? (secenek.govde !== undefined || secenek.formData ? "POST" : "GET");
  const h = new Headers();
  h.set("x-servis-anahtari", (process.env.SERVIS_ANAHTARI ?? "").trim());
  const ip = await istemciIp();
  if (ip) h.set("x-istemci-ip", ip);
  if (secenek.oturum !== false) {
    const j = await jeton();
    if (j) h.set("authorization", `Bearer ${j}`);
  }

  let body: BodyInit | undefined;
  if (secenek.formData) {
    body = secenek.formData; // sınır (boundary) başlığını fetch kendisi yazar
  } else if (secenek.govde !== undefined) {
    h.set("content-type", "application/json");
    body = JSON.stringify(secenek.govde);
  }

  try {
    return await fetch(`${tabanAdres()}${yol}`, {
      method,
      headers: h,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });
  } catch (e) {
    // Sorgu dizesi günlüğe yazılmaz: arama kutusundaki ad/e-posta kişisel veri.
    console.error(`[admin] backend'e ulaşılamadı: ${method} ${yol.split("?")[0]} — ${(e as Error).message}`);
    return null;
  }
}

/** Yanıtı tipli sonuca çevirir (OTURUM_YOK yönlendirmesi yapmaz). */
export async function yanitiCoz<T>(res: Response | null): Promise<ApiSonucu<T>> {
  if (!res) return { ok: false, hata: { kod: "BAGLANTI", mesaj: MESAJLAR.BAGLANTI, durum: 0 } };

  const metin = await res.text().catch(() => "");
  let json: unknown = null;
  if (metin) {
    try {
      json = JSON.parse(metin);
    } catch {
      json = null;
    }
  }

  if (res.ok) return { ok: true, veri: (json ?? null) as T, durum: res.status };

  const ham = (json && typeof json === "object" && "hata" in json ? (json as { hata: unknown }).hata : null) as {
    kod?: unknown;
    mesaj?: unknown;
    alanlar?: unknown;
    ek?: unknown;
  } | null;

  const kod = typeof ham?.kod === "string" ? ham.kod : res.status >= 500 ? "SUNUCU" : `HTTP_${res.status}`;
  let mesaj = typeof ham?.mesaj === "string" && ham.mesaj.trim() ? ham.mesaj : (MESAJLAR[kod] ?? `İstek başarısız (${res.status}).`);
  // Bu ikisinde kullanıcıya her zaman aynı, anlaşılır cümle.
  if (kod === "YETKI_YOK" || kod === "SERVIS_ANAHTARI") mesaj = MESAJLAR[kod];
  if (res.status >= 500) console.error(`[admin] backend ${res.status} ${kod} ${res.url.split("?")[0]}`);

  const alanlar =
    ham?.alanlar && typeof ham.alanlar === "object"
      ? Object.fromEntries(Object.entries(ham.alanlar as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
      : undefined;

  return { ok: false, hata: { kod, mesaj, alanlar, ek: ham?.ek, durum: res.status } };
}

/** Şu anki sayfanın yolu (proxy.ts `x-yol` başlığına yazar); girişten sonra dönülür. */
export async function suankiYol(): Promise<string | null> {
  try {
    return guvenliYol((await headers()).get("x-yol"));
  } catch {
    return null;
  }
}

/** Yalnızca bu panelin kendi yolları: "//evil.com" gibi değerler reddedilir. */
export function guvenliYol(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 1000) return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  if (v.startsWith("/giris") || v.startsWith("/oturum-bitti") || v.startsWith("/api/")) return null;
  return v;
}

export function girisAdresi(sonraki: string | null, durum?: "bitti" | "cikis"): string {
  const p = new URLSearchParams();
  if (sonraki && sonraki !== "/") p.set("sonraki", sonraki);
  if (durum) p.set("durum", durum);
  const q = p.toString();
  return q ? `/giris?${q}` : "/giris";
}

/**
 * Oturum geçersiz: çerezi sil ve girişe git. Çerez yalnızca server action ve
 * route handler'da silinebilir; sunucu bileşenindeysek silmeyi
 * /oturum-bitti route handler'ına bırakırız.
 */
export async function oturumuSonlandir(): Promise<never> {
  const sonraki = await suankiYol();
  let silindi = false;
  try {
    (await cookies()).delete(OTURUM_CEREZI);
    silindi = true;
  } catch {
    silindi = false;
  }
  if (silindi) redirect(girisAdresi(sonraki, "bitti"));
  redirect(sonraki ? `/oturum-bitti?sonraki=${encodeURIComponent(sonraki)}` : "/oturum-bitti");
}

/** JSON çağrısı: tipli sonuç. OTURUM_YOK'ta (varsayılan) girişe yönlendirir. */
export async function api<T>(yol: string, secenek: IstekSecenekleri = {}): Promise<ApiSonucu<T>> {
  const sonuc = await yanitiCoz<T>(await backendHam(yol, secenek));
  if (!sonuc.ok && sonuc.hata.kod === "OTURUM_YOK" && secenek.oturum !== false && secenek.oturumYoksa !== "dondur") {
    await oturumuSonlandir();
  }
  return sonuc;
}

/**
 * Sunucu bileşenleri için okuma: veriyi döndürür ya da sayfayı kesler.
 * BULUNAMADI → 404 sayfası; diğer hatalar → error.tsx (mesajıyla).
 */
export async function oku<T>(yol: string): Promise<T> {
  const s = await api<T>(yol);
  if (s.ok) return s.veri;
  if (s.hata.kod === "BULUNAMADI") notFound();
  throw new Error(s.hata.mesaj);
}
