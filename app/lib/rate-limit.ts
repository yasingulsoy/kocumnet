import "server-only";
import { headers } from "next/headers";
import { istemciIpBelirle } from "./istemci-ip";

/**
 * Basit deneme sınırlayıcı — süreç belleğinde.
 *
 * Tek konteynerde yeterli; yatay ölçeklenince her kopya kendi sayacını
 * tutar (o gün Redis/Postgres'e taşınır). Eskiden yalnızca girişte vardı
 * ve kendi dosyasının içindeydi; kayıt, parola sıfırlama ve parola değiştirme
 * sınırsızdı — her biri scrypt (≈64 MB, ~100 ms) çalıştırdığı için bir
 * istek seli bütün uygulamayı yavaşlatabiliyordu.
 *
 * Anahtar: istemci IP + eylem (+ hedef); giriş yapmış eylemlerde IP yerine
 * kullanıcı kimliği (sinirAsildiKullanici). Harita periyodik olarak budanır;
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

/** Kuralı lib/istemci-ip.ts'te: Traefik'in x-real-ip'i, Cloudflare'den geliyorsa cf-connecting-ip. */
async function istemci(): Promise<string> {
  const h = await headers();
  return istemciIpBelirle(h.get("x-real-ip"), h.get("cf-connecting-ip")) ?? "local";
}

function say(k: string, limit: number, pencereMs: number): boolean {
  const now = Date.now();
  buda(now);
  const rec = kayitlar.get(k);
  if (!rec || rec.until < now) {
    kayitlar.set(k, { count: 1, until: now + pencereMs });
    return false;
  }
  rec.count += 1;
  return rec.count > limit;
}

/**
 * true → sınır aşıldı, isteği reddet.
 * @param anahtar  "eylem:hedef" (IP otomatik eklenir)
 * @param limit    pencere içinde izin verilen deneme
 * @param pencereMs pencere süresi
 */
export async function sinirAsildi(anahtar: string, limit: number, pencereMs: number): Promise<boolean> {
  return say(`${await istemci()}|${anahtar}`, limit, pencereMs);
}

/**
 * Giriş yapmış kullanıcının eylemi: IP yerine kullanıcı kimliğiyle sayılır.
 * Okuldan toplu kullanımda (tek NAT, tek IP) bir öğrencinin seli sınıfın
 * geri kalanını kilitlemesin; IP değiştirerek de sınır sıfırlanmasın.
 */
export async function sinirAsildiKullanici(
  userId: string,
  anahtar: string,
  limit: number,
  pencereMs: number
): Promise<boolean> {
  return say(`u:${userId}|${anahtar}`, limit, pencereMs);
}

/** Başarılı girişte sayaç sıfırlanır: doğru parolayı bilen kilitli kalmasın. */
export async function sinirSifirla(anahtar: string) {
  kayitlar.delete(`${await istemci()}|${anahtar}`);
}
