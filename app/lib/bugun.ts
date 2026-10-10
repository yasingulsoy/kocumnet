/**
 * Panonun "Bugün" kartı: öğrenciye bugün yapacağı TEK işi söyler.
 *
 * Sıra (ilk tutan kazanır):
 *  1. Yarım kalan test (süre işliyor) ya da yarım kalan seviyeli check-up.
 *  2. Yanlış defteri: bugünkü tekrar ya da yarım kalan tekrar. Bugünkü
 *     tekrar bittiyse ya da vadesi gelen maddenin benzeri yoksa atlanır.
 *  3. Haftalık planın sıradaki işi (bitmemiş ilk iş).
 *  4. Önerilen test (katalogdan).
 *
 * Saf modül: veriyi pano zaten yüklüyor, burada yalnızca karar var. Kural
 * testleri `npm run smoke`'ta.
 */

export interface BugunTekrar {
  /** Yarım kalan "bugünkü tekrar" oturumu. */
  acik: { id: string; kalan: number; toplam: number } | null;
  /** Şimdi açılırsa kaç soru gelir (günlük sınır ve benzer havuzu düşülmüş). */
  hazir: number;
}

export type BugunIsi<T, S, P, O> =
  | { tur: "TEST"; test: T }
  | { tur: "SEVIYELI"; kosu: S }
  | { tur: "TEKRAR_DEVAM"; oturum: { id: string; kalan: number; toplam: number } }
  | { tur: "TEKRAR"; soru: number }
  | { tur: "PLAN"; is: P; kalan: number }
  | { tur: "ONERI"; paket: O }
  | { tur: "YOK" };

export function bugunkuIs<T, S, P extends { done: boolean }, O>(g: {
  /** Süresi dolmamış, alıştırma olmayan açık oturum. */
  acikTest: T | null;
  /** Yarım kalan seviyeli check-up (aşaması açık değilse; açıksa acikTest). */
  seviyeli: S | null;
  tekrar: BugunTekrar;
  /** Bu haftanın planındaki işler, plandaki sırayla. */
  planIsleri: readonly P[] | null;
  oneri: O | null;
}): BugunIsi<T, S, P, O> {
  if (g.acikTest) return { tur: "TEST", test: g.acikTest };
  if (g.seviyeli) return { tur: "SEVIYELI", kosu: g.seviyeli };
  if (g.tekrar.acik) return { tur: "TEKRAR_DEVAM", oturum: g.tekrar.acik };
  if (g.tekrar.hazir > 0) return { tur: "TEKRAR", soru: g.tekrar.hazir };
  const kalanIsler = (g.planIsleri ?? []).filter((i) => !i.done);
  if (kalanIsler.length > 0) return { tur: "PLAN", is: kalanIsler[0], kalan: kalanIsler.length };
  if (g.oneri) return { tur: "ONERI", paket: g.oneri };
  return { tur: "YOK" };
}
