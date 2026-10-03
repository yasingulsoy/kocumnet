import "server-only";
import { headers } from "next/headers";

/**
 * Basit deneme sınırlayıcı — süreç belleğinde.
 *
 * Tek konteynerde yeterli; yatay ölçeklenince her kopya kendi sayacını
 * tutar (o gün Redis/Postgres'e taşınır). Eskiden yalnızca girişte vardı
 * ve kendi dosyasının içindeydi; kayıt, parola sıfırlama ve parola değiştirme
 * sınırsızdı — her biri scrypt (≈64 MB, ~100 ms) çalıştırdığı için bir
 * istek seli bütün uygulamayı yavaşlatabiliyordu.
 *
 * Anahtar: istemci IP + eylem (+ hedef). Harita periyodik olarak budanır;
 * eskiden hiç budanmıyordu ve zamanla şişiyordu.
 */

interface Kayit {
  count: number;
  until: number;
}

const kayitlar = new Map<string, Kayit>();
let sonBudama = Date.now();

function buda(now: number) {
  if (now - sonBudama < 60_000) return;
  sonBudama = now;
  for (const [k, v] of kayitlar) if (v.until < now) kayitlar.delete(k);
}

/**
 * true → sınır aşıldı, isteği reddet.
 * @param anahtar  "eylem:hedef" (IP otomatik eklenir)
 * @param limit    pencere içinde izin verilen deneme
 * @param pencereMs pencere süresi
 */
export async function sinirAsildi(anahtar: string, limit: number, pencereMs: number): Promise<boolean> {
  const h = await headers();
  // Ters vekil arkasında ilk x-forwarded-for; yoksa yerel. Vekil bu başlığı
  // ÜZERİNE YAZMALI (Dokploy/Traefik yazar), yoksa sahte başlıkla atlatılır.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  buda(now);

  const k = `${ip}|${anahtar}`;
  const rec = kayitlar.get(k);
  if (!rec || rec.until < now) {
    kayitlar.set(k, { count: 1, until: now + pencereMs });
    return false;
  }
  rec.count += 1;
  return rec.count > limit;
}

/** Başarılı girişte sayaç sıfırlanır: doğru parolayı bilen kilitli kalmasın. */
export async function sinirSifirla(anahtar: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  kayitlar.delete(`${ip}|${anahtar}`);
}
