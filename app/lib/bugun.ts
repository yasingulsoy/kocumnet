/**
 * Panonun "Bugün" kartı: öğrenciye bugün yapacağı TEK işi söyler.
 *
 * Sıra (ilk tutan kazanır):
 *  1. Süresi işleyen EKRAN testi (ONLINE): yarıda bırakılmaz.
 *  2. Koçun ödevi ile açık KÂĞIT oturumu: ikisinden son anı daha yakın olan
 *     (ödevin son tarihi; kâğıtta cevapları optik forma işleme son anı,
 *     expiresAt). İki saati kalmış kâğıt üç gün sonraki ödevden önce; yarın
 *     biten ödev iki gün sonra kapanacak kâğıttan önce. Eskiden pano tek bir
 *     açık oturum seçiyordu (en yeni başlayan): 48 saat açık kalan kâğıt,
 *     süresi işleyen ekran testinin ve son günü gelen ödevin önüne geçiyordu.
 *     Ödev: son tarihi 3 gün içinde olan bitmemiş ödev (lib/odev.ts bugunOdevi).
 *  3. Yarım kalan seviyeli check-up.
 *  4. Yanlış defteri: bugünkü tekrar ya da yarım kalan tekrar. Bugünkü
 *     tekrar bittiyse ya da vadesi gelen maddenin benzeri yoksa atlanır.
 *  5. Haftalık planın sıradaki işi (bitmemiş ilk iş).
 *  6. Önerilen test (katalogdan).
 *
 * Saf modül: veriyi pano zaten yüklüyor, burada yalnızca karar var. Kural
 * testleri `npm run smoke`'ta (ödev sırası scripts/odev-test.mts'te).
 */

export interface BugunTekrar {
  /** Yarım kalan "bugünkü tekrar" oturumu. */
  acik: { id: string; kalan: number; toplam: number } | null;
  /** Şimdi açılırsa kaç soru gelir (günlük sınır ve benzer havuzu düşülmüş). */
  hazir: number;
}

export type BugunIsi<T, S, P, O, D = never> =
  | { tur: "TEST"; test: T }
  | { tur: "ODEV"; odev: D }
  | { tur: "SEVIYELI"; kosu: S }
  | { tur: "TEKRAR_DEVAM"; oturum: { id: string; kalan: number; toplam: number } }
  | { tur: "TEKRAR"; soru: number }
  | { tur: "PLAN"; is: P; kalan: number }
  | { tur: "ONERI"; paket: O }
  | { tur: "YOK" };

export function bugunkuIs<T, S, P extends { done: boolean; acilabilir?: boolean }, O, D = never>(g: {
  /** Süresi işleyen EKRAN (ONLINE) testi: süresi dolmamış, alıştırma olmayan açık oturum. */
  acikTest: T | null;
  /** Açık kâğıt oturumu ve son anı (cevapları optik forma işleme, expiresAt). */
  kagit?: { test: T; sonAn: Date } | null;
  /** Son tarihi yakın, bitmemiş ödev (lib/odev.ts bugunOdevi seçer). */
  odev?: D | null;
  /** Ödevin son anı (dueAt). Verilmezse kâğıt ödevin önünde (açık test ödevin önünde kuralı). */
  odevSonAn?: Date | null;
  /** Yarım kalan seviyeli check-up (aşaması açık değilse; açıksa acikTest). */
  seviyeli: S | null;
  tekrar: BugunTekrar;
  /** Bu haftanın planındaki işler, plandaki sırayla. */
  planIsleri: readonly P[] | null;
  oneri: O | null;
}): BugunIsi<T, S, P, O, D> {
  if (g.acikTest) return { tur: "TEST", test: g.acikTest };
  const kagit = g.kagit ?? null;
  const odev = g.odev ?? null;
  if (kagit && odev) {
    // Eşitlikte kâğıt: optik form birkaç dakikalık iş, ödev değil.
    const kagitOnce = !g.odevSonAn || kagit.sonAn.getTime() <= g.odevSonAn.getTime();
    return kagitOnce ? { tur: "TEST", test: kagit.test } : { tur: "ODEV", odev };
  }
  if (kagit) return { tur: "TEST", test: kagit.test };
  if (odev) return { tur: "ODEV", odev };
  if (g.seviyeli) return { tur: "SEVIYELI", kosu: g.seviyeli };
  if (g.tekrar.acik) return { tur: "TEKRAR_DEVAM", oturum: g.tekrar.acik };
  if (g.tekrar.hazir > 0) return { tur: "TEKRAR", soru: g.tekrar.hazir };
  // Açılamayan kontrol testi (konu planın sınavında değil) Bugün kartına
  // gelmez: öğrenciyi her gün aynı hataya götürürdü; plan kartında silinebilir.
  const kalanIsler = (g.planIsleri ?? []).filter((i) => !i.done && i.acilabilir !== false);
  if (kalanIsler.length > 0) return { tur: "PLAN", is: kalanIsler[0], kalan: kalanIsler.length };
  if (g.oneri) return { tur: "ONERI", paket: g.oneri };
  return { tur: "YOK" };
}
