import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { OTURUM_CEREZI } from "./cerezler";
import { istemciIp } from "./istemci-ip";
import type { ApiHata, HataKodu, Ogrenci, Sonuc } from "./tipler";

/**
 * Backend köprüsü (BFF). Tarayıcı backend'le HİÇ konuşmaz: her istek bu
 * sunucudan, iç ağdaki BACKEND_URL'e gider (checkup/API.md "Genel kurallar").
 *
 *  · Her istekte x-servis-anahtari ve x-istemci-ip (hız sınırları IP'ye göre).
 *  · Oturum gereken uçlarda httpOnly çerezdeki jeton Authorization: Bearer olur.
 *  · Yanıt { ok, veri } ya da { ok: false, hata } olarak döner; API.md'nin
 *    hata biçimi (kod, mesaj, alanlar, ek) olduğu gibi taşınır.
 *  · Oturum düştüyse (OTURUM_YOK) çerez temizlenir ve girişe gidilir.
 *  · Önbellek yok (no-store): her şey öğrenciye özel ve anlık.
 */

const ZAMAN_ASIMI_MS = 15_000;

const GENEL_HATA = "Bir sorun oluştu. Biraz sonra yeniden dene.";

/** Kullanıcıya gösterilmeyecek iç hatalar (anahtar, sunucu) için sade cümleler. */
const VARSAYILAN_MESAJ: Partial<Record<HataKodu, string>> = {
  SERVIS_ANAHTARI: GENEL_HATA,
  SUNUCU: GENEL_HATA,
  ULASILAMADI: "Sunucuya şu an ulaşılamıyor. Biraz sonra yeniden dene.",
  OTURUM_YOK: "Oturumun kapanmış. Yeniden giriş yap.",
  BULUNAMADI: "Aradığın kayıt bulunamadı.",
  COK_FAZLA_ISTEK: "Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.",
};

const BILINEN_KODLAR = new Set<string>([
  "SERVIS_ANAHTARI",
  "OTURUM_YOK",
  "YETKI_YOK",
  "BULUNAMADI",
  "DOGRULAMA",
  "CAKISMA",
  "KULLANIMDA",
  "HAZIR_DEGIL",
  "ACIK_CHECKUP_VAR",
  "SURE_DOLDU",
  "KAPANDI",
  "COK_FAZLA_ISTEK",
  "SUNUCU",
]);

function tabanAdres(): string | null {
  const url = (process.env.BACKEND_URL ?? "").trim().replace(/\/+$/, "");
  return url ? `${url}/api` : null;
}

function nesneMi(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

function metinSozlugu(d: unknown): Record<string, string> | undefined {
  if (!nesneMi(d)) return undefined;
  const sonuc: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) if (typeof v === "string") sonuc[k] = v;
  return Object.keys(sonuc).length ? sonuc : undefined;
}

/** API.md hata gövdesini tipli hataya çevirir; gövde bozuksa durum kodundan tahmin eder. */
function hataCoz(govde: unknown, durum: number): ApiHata {
  const h = nesneMi(govde) && nesneMi(govde.hata) ? govde.hata : null;
  let kod: HataKodu;
  if (h && typeof h.kod === "string" && BILINEN_KODLAR.has(h.kod)) kod = h.kod as HataKodu;
  else if (durum === 404) kod = "BULUNAMADI";
  else if (durum === 429) kod = "COK_FAZLA_ISTEK";
  else if (durum === 400) kod = "DOGRULAMA";
  else kod = "SUNUCU";

  // İç hatalarda backend'in cümlesi kullanıcıya gösterilmez.
  const icHata = kod === "SERVIS_ANAHTARI" || kod === "SUNUCU";
  const mesaj = !icHata && h && typeof h.mesaj === "string" && h.mesaj.trim() ? h.mesaj : (VARSAYILAN_MESAJ[kod] ?? GENEL_HATA);

  return {
    kod,
    mesaj,
    alanlar: h ? metinSozlugu(h.alanlar) : undefined,
    ek: h && nesneMi(h.ek) ? h.ek : undefined,
    durum,
  };
}

function ulasilamadi(): { ok: false; hata: ApiHata } {
  return { ok: false, hata: { kod: "ULASILAMADI", mesaj: VARSAYILAN_MESAJ.ULASILAMADI!, durum: 0 } };
}

/**
 * Oturum düştü: çerezi sil, girişe git.
 *
 * Çerez yalnızca sunucu eyleminde ve route handler'da silinebilir; sunucu
 * bileşeni çizilirken silmeye çalışmak hata atar. O durumda işi
 * /oturum-bitti route handler'ına bırakıyoruz (o siler ve girişe yollar).
 */
async function oturumBitti(): Promise<never> {
  let silindi = false;
  try {
    (await cookies()).delete(OTURUM_CEREZI);
    silindi = true;
  } catch {
    silindi = false;
  }
  // redirect try'ın DIŞINDA: NEXT_REDIRECT hatası yutulmasın.
  redirect(silindi ? "/giris?oturum=bitti" : "/oturum-bitti");
}

export interface Istek {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  govde?: unknown;
  /**
   * Oturum jetonunu gönder (varsayılan true). Kayıt, giriş ve parola
   * sıfırlama uçlarında false: jeton gitmez, OTURUM_YOK dönerse de yönlendirme
   * yapılmaz (ör. yanlış parola böyle dönebilir).
   */
  oturum?: boolean;
  /**
   * true: oturum yoksa ya da düştüyse yönlendirme YAPMA, hatayı döndür.
   * Giriş sayfası "zaten girişli mi?" diye bakarken kullanır.
   */
  sessiz?: boolean;
}

export async function api<T>(yol: string, istek: Istek = {}): Promise<Sonuc<T>> {
  // Derleme sırasında asla backend'e gidilmez: her çağrı bir isteğe bağlı (sayfa dinamik çizilir).
  await connection();
  const method = istek.method ?? "GET";
  const oturumlu = istek.oturum !== false;

  const taban = tabanAdres();
  if (!taban) {
    console.error("[checkup] BACKEND_URL tanımlı değil");
    return ulasilamadi();
  }

  const basliklar = new Headers({ accept: "application/json" });
  basliklar.set("x-servis-anahtari", process.env.SERVIS_ANAHTARI ?? "");
  const ip = await istemciIp();
  if (ip) basliklar.set("x-istemci-ip", ip);

  if (oturumlu) {
    const jeton = (await cookies()).get(OTURUM_CEREZI)?.value;
    if (!jeton) {
      if (istek.sessiz) return { ok: false, hata: { kod: "OTURUM_YOK", mesaj: VARSAYILAN_MESAJ.OTURUM_YOK!, durum: 401 } };
      redirect("/giris");
    }
    basliklar.set("authorization", `Bearer ${jeton}`);
  }

  let govde: string | undefined;
  if (istek.govde !== undefined) {
    basliklar.set("content-type", "application/json");
    govde = JSON.stringify(istek.govde);
  }

  let yanit: Response;
  try {
    yanit = await fetch(`${taban}${yol}`, {
      method,
      headers: basliklar,
      body: govde,
      cache: "no-store",
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });
  } catch (e) {
    // Sorgu dizesi günlüğe yazılmaz (kişisel veri taşıyabilir).
    console.error(`[checkup] backend'e ulaşılamadı: ${method} ${yol.split("?")[0]} (${(e as Error).message})`);
    return ulasilamadi();
  }

  if (yanit.status === 204) return { ok: true, veri: undefined as T };

  const json: unknown = await yanit.json().catch(() => null);

  if (yanit.ok) {
    if (json === null) {
      console.error(`[checkup] backend yanıtı okunamadı: ${method} ${yol.split("?")[0]} ${yanit.status}`);
      return ulasilamadi();
    }
    return { ok: true, veri: json as T };
  }

  const hata = hataCoz(json, yanit.status);
  if (hata.kod === "SERVIS_ANAHTARI" || hata.kod === "SUNUCU") {
    console.error(`[checkup] backend ${yanit.status} ${hata.kod}: ${method} ${yol.split("?")[0]}`);
  }
  if (hata.kod === "OTURUM_YOK" && oturumlu && !istek.sessiz) await oturumBitti();
  return { ok: false, hata };
}

/**
 * Sayfa verisi: başarılıysa veriyi verir. Kayıt yoksa 404 sayfası, başka
 * hatada error.tsx (mesaj üretimde gizlenir, günlükte kalır).
 */
export function sayfaVerisi<T>(sonuc: Sonuc<T>): T {
  if (sonuc.ok) return sonuc.veri;
  if (sonuc.hata.kod === "BULUNAMADI") notFound();
  throw new Error(`${sonuc.hata.kod}: ${sonuc.hata.mesaj}`);
}

/**
 * Girişli öğrenci. Korunan her sayfanın düzeni bunu çağırır: oturum yoksa
 * ya da düştüyse girişe yönlendirir. Aynı istekte bir kez backend'e gider.
 */
export const girisliOgrenci = cache(async (): Promise<Ogrenci> => {
  const sonuc = await api<{ ogrenci: Ogrenci }>("/ogrenci/ben");
  return sayfaVerisi(sonuc).ogrenci;
});

/**
 * Yönlendirmesiz bakış: girişliyse öğrenci, değilse (ya da backend
 * yanıt vermezse) null. Ana sayfa ve giriş sayfaları "zaten girişli mi?"
 * diye bakarken kullanır.
 */
export async function oturumluOgrenci(): Promise<Ogrenci | null> {
  if (!(await cookies()).has(OTURUM_CEREZI)) return null;
  const sonuc = await api<{ ogrenci: Ogrenci }>("/ogrenci/ben", { sessiz: true });
  return sonuc.ok ? sonuc.veri.ogrenci : null;
}
