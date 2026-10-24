import { egilimeGirer, konuHaritasinaGirer, olcumDisi, isaretsiz, type OlcumKaydi } from "./shared/insights";

/**
 * Öğrenci listesi ve öğrenci ayrıntısının ORTAK okumaları — saf modül.
 * Listedeki "Test" ve "Son başarı" ayrıntı sayfasındaki "Tamamlanan test" ile
 * aynı kuraldan çıkmalı (shared/insights.ts egilimeGirer: işaretli, yarım
 * kalmamış paket testleri, tek sınavdan); yoksa liste "6 test" der, ayrıntı "4".
 *
 * Sonuçlar YENİDEN ESKİYE sıralı gelir. Her sonuç `blankCount` ve oturumun
 * `endedBy`'ını taşımalı: seçilmezse yarım test kuralı sessizce işlemez.
 */

export type OlcumSonucu = OlcumKaydi & { examScope: string; blankCount: number };

/**
 * Özet ve konu haritası hangi sınavdan: istenen (ölçümü varsa), sonra hedef
 * sınav (ölçümü varsa), sonra en son ölçülen sınav. LGS ile TYT sonuçlarını
 * tek "genel başarı"da toplamak anlamsız.
 */
export function olcumSinavi(
  sonuclar: readonly OlcumSonucu[],
  hedef: string | null,
  istenen: string | null = null
): { sinav: string | null; olculenSinavlar: string[] } {
  // İlk görülen sınav en son ölçülen (sonuçlar yeniden eskiye).
  const olculenSinavlar = [...new Set(sonuclar.filter((r) => konuHaritasinaGirer(r)).map((r) => r.examScope))];
  const sinav =
    (istenen && olculenSinavlar.includes(istenen) ? istenen : null) ??
    (hedef && olculenSinavlar.includes(hedef) ? hedef : null) ??
    olculenSinavlar[0] ??
    null;
  return { sinav, olculenSinavlar };
}

/** Listedeki iki sütun: ölçüm sayılan paket testi sayısı ve en sonuncusunun başarısı (0-1). */
export function listeOzeti(sonuclar: readonly OlcumSonucu[], hedef: string | null): { test: number; sonBasari: number | null } {
  const { sinav } = olcumSinavi(sonuclar, hedef);
  const olcumler = sonuclar.filter((r) => egilimeGirer(r, sinav));
  const son = olcumler[0];
  const toplam = son ? son.correctCount + son.wrongCount + son.blankCount : 0;
  return { test: olcumler.length, sonBasari: son && toplam > 0 ? son.correctCount / toplam : null };
}

/** Test geçmişinde ölçüme girmeyen testin nedeni (koç "neden sayılmadı" diye sormasın). */
export function olcumDisiNedeni(r: OlcumKaydi): string | null {
  if (!olcumDisi(r)) return null;
  return isaretsiz(r) ? "boş gönderildi, sayılmadı" : "yarım kaldı, sayılmadı";
}

/**
 * Listede ve ayrıntıda "Son etkinlik": oturumla yapılan son istek
 * (User.lastSeenAt, en fazla saatte bir yazılır); yoksa ya da giriş daha
 * yeniyse son giriş. lastLoginAt yalnızca parolayla girişte ilerliyor;
 * oturum 30 gün açık kaldığı için her gün çalışan öğrenci "hiç girmedi"
 * görünüyordu. İkisi de boşsa null ("hiç girmedi").
 */
export function sonGorulme(u: { lastSeenAt: Date | null; lastLoginAt: Date | null }): Date | null {
  if (!u.lastSeenAt) return u.lastLoginAt;
  if (!u.lastLoginAt) return u.lastSeenAt;
  return u.lastSeenAt > u.lastLoginAt ? u.lastSeenAt : u.lastLoginAt;
}
