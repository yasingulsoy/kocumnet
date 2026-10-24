/**
 * Kanonik site adresi. Üretimde .env içinde NEXT_PUBLIC_SITE_URL tanımlayın (örn. https://www.ornek.com).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Matematik Check-up uygulamasının adresi (NEXT_PUBLIC_CHECKUP_URL; derleme
 * anında gömülür, bkz. DEPLOY.md). Ana sayfadaki check-up bölümü, başlık
 * şeridi, mobil menü ve altbilgi bunu okur.
 *
 * Tanımlı değilse (ya da http ile başlamıyorsa) check-up bağlantılarının
 * HİÇBİRİ çıkmaz: uygulama yayına alınmadan sitede 404'e giden bir düğme
 * durmasın. Uygulama açılınca tek değişkenle her yerde görünür.
 */
const checkupHam = process.env.NEXT_PUBLIC_CHECKUP_URL?.trim() ?? "";
export const CHECKUP_URL: string | null = /^https?:\/\//.test(checkupHam)
  ? checkupHam.replace(/\/$/, "")
  : null;

/**
 * Check-up'a giden bağlantının kaynak etiketi (`?k=`): öğrenci kayıt olunca
 * hangi bağlantıdan geldiği toplam sayı olarak sayılır (panelde "Kayıt
 * kaynağı"). Çerez, IP, yönlendiren adres yok; yalnızca bu kısa etiket.
 *
 * İzin listesi öğrenci uygulamasında: listede olmayan etiket kaydedilmez.
 * Buradaki liste onun aynısı olmalı; yeni bir yer eklenecekse önce orada.
 * Etiket dile bağlı DEĞİL: TR, EN ve AR sayfalarındaki aynı bağlantı aynı
 * etiketi taşır (dil ayrımı panelde istenmiyor).
 */
export const CHECKUP_KAYNAKLARI = [
  "ust", // başlık şeridi ve mobil menü
  "hero", // ana sayfa giriş bölümü
  "bolum", // ana sayfadaki check-up bölümü
  "altbilgi",
  "blog", // blog yazılarının içindeki bağlantılar
  "iletisim",
  "whatsapp",
  "instagram",
  "diger",
] as const;
export type CheckupKaynagi = (typeof CHECKUP_KAYNAKLARI)[number];

/**
 * Check-up adresi + etiket. Uygulama adresi tanımlı değilse null: çağıran
 * bağlantıyı hiç çizmez (yukarıdaki CHECKUP_URL kuralı).
 */
export function checkupAdresi(kaynak: CheckupKaynagi, yol = ""): string | null {
  if (!CHECKUP_URL) return null;
  const u = new URL(CHECKUP_URL + yol);
  u.searchParams.set("k", kaynak);
  return u.toString();
}

/**
 * Serbest metindeki (blog yazısı) bir adres check-up'a gidiyorsa ve etiketi
 * yoksa etiketi ekler; başka her adresi olduğu gibi bırakır. Yazar elle
 * etiket koyduysa (`?k=instagram`) ona dokunulmaz.
 */
export function checkupEtiketle(adres: string, kaynak: CheckupKaynagi): string {
  if (!CHECKUP_URL) return adres;
  let u: URL;
  try {
    u = new URL(adres);
  } catch {
    return adres;
  }
  if (u.origin !== new URL(CHECKUP_URL).origin || u.searchParams.has("k")) return adres;
  u.searchParams.set("k", kaynak);
  return u.toString();
}
