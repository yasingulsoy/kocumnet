/**
 * Veli bağlantısı — kurallar ve sabitler (saf modül; profil kartı da okur).
 * Veritabanı tarafı lib/veli-raporu.ts, eylemler lib/actions/veli.ts,
 * sayfa app/veli/[token].
 *
 * Karar (Hocaya sorular: motivasyon.veli-kapsam bekliyor): veli yalnızca GENEL TABLOYU görür.
 * Soru, cevap, çözüm, e-posta ve başka kişisel bilgi görünmez. Karar
 * değişirse önce lib/veli-raporu.ts'teki VeliRaporu tipi ve /gizlilik değişir.
 */

/** Geçerlilik seçenekleri (gün). */
export const VELI_SURELERI = [7, 30, 90] as const;
export type VeliSuresi = (typeof VELI_SURELERI)[number];
export const VARSAYILAN_VELI_SURESI: VeliSuresi = 30;

/** Bir öğrencinin aynı anda en fazla bu kadar etkin bağlantısı olabilir. */
export const EN_FAZLA_VELI_BAGLANTISI = 3;

/** Süresi dolan ya da kaldırılan bağlantının kaydı bu kadar gün sonra silinir (bakım). */
export const VELI_KAYIT_SAKLAMA_GUN = 30;

/** Raporda: grafikte en fazla bu kadar ölçüm, listede bu kadar test, konu listelerinde bu kadar konu. */
export const RAPOR_OLCUM_SINIRI = 12;
export const RAPOR_TEST_SAYISI = 5;
export const RAPOR_KONU_SAYISI = 5;

/** Jeton: 32 bayt rastgele, base64url (43 karakter). Başka biçim veritabanına sorulmaz. */
export const VELI_JETONU = /^[A-Za-z0-9_-]{43}$/;

export function veliSuresiMi(x: unknown): x is VeliSuresi {
  return typeof x === "number" && (VELI_SURELERI as readonly number[]).includes(x);
}

/** Adın yalnızca ilk kelimesi: "Ayşe Nur Yılmaz" → "Ayşe". Soyadı veliye gitmez. */
export function ilkAd(adSoyad: string): string {
  return adSoyad.trim().split(/\s+/)[0] || "Öğrenci";
}

/**
 * Bağlantı önizlemesi çeken botlar (WhatsApp, Telegram, Slack…). Onlara veri
 * gösterilmez ve açılma sayılmaz: bazı uygulamalar önizlemeyi kendi
 * sunucusunda çeker; rapor üçüncü bir sunucuya düşmesin. WhatsApp'ın
 * önizleyicisi "WhatsApp/2.x" ile BAŞLAR; uygulama içi tarayıcı "Mozilla/…"
 * ile başladığı için veli raporu normal görür.
 */
const ONIZLEYICI =
  /^whatsapp\/|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|pinterestbot|redditbot|embedly|googlebot|bingbot|yandexbot|applebot|duckduckbot|bot\/\d/i;

export function onizleyiciMi(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && ONIZLEYICI.test(userAgent));
}

const gunAy = (d: Date) =>
  d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" });

/** Öğrencinin velisine göndereceği kısa mesaj; bağlantı sonda (önizleme için). */
export function veliMesaji(link: string, bitis: Date): string {
  return `Koçum.Net'teki matematik check-up durumum bu bağlantıda (${gunAy(bitis)} tarihine kadar açık): ${link}`;
}

/** WhatsApp paylaşım adresi: alıcıyı öğrenci WhatsApp'ta seçer. */
export function whatsappAdresi(link: string, bitis: Date): string {
  return "https://wa.me/?text=" + encodeURIComponent(veliMesaji(link, bitis));
}
