import "server-only";
import { api, type IstekSecenekleri } from "./backend";
import type { IslemSonucu, Seviye } from "./tipler";

/**
 * Server action yardımcıları. Server action'lar herkese açık uçlardır: yetki
 * backend'de denetlenir (her istek kullanıcının kendi jetonuyla gider). Burada
 * yalnızca yol parçalarına giren değerler doğrulanır.
 */

/** Backend çağrısı → istemciye dönecek serileştirilebilir sonuç. */
export async function cagir<T = null>(yol: string, secenek: IstekSecenekleri = {}): Promise<IslemSonucu<T>> {
  const s = await api<T>(yol, secenek);
  if (s.ok) return { ok: true, veri: s.veri };
  return { ok: false, kod: s.hata.kod, mesaj: s.hata.mesaj, alanlar: s.hata.alanlar, ek: s.hata.ek };
}

export function gecersiz<T = null>(mesaj = "Geçersiz istek."): IslemSonucu<T> {
  return { ok: false, kod: "DOGRULAMA", mesaj };
}

/** Yol parçasına girecek kimlik: pozitif tam sayı. */
export function kimlik(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const SEVIYELER: readonly Seviye[] = ["dersler", "konular", "kazanimlar", "alt-kazanimlar"];

export function seviye(v: unknown): Seviye | null {
  return SEVIYELER.includes(v as Seviye) ? (v as Seviye) : null;
}

/** Metin alanı: dize değilse boş dize. */
export function metin(v: unknown, enFazla = 20_000): string {
  return typeof v === "string" ? v.slice(0, enFazla) : "";
}
