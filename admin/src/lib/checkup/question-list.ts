/**
 * Soru listesinin adres süzgeçleri — liste, soru ekranı ve kaydetme eylemi
 * aynı kuralı kullanır. Saf modül ("use server" dosyası yalnızca async
 * fonksiyon ihraç edebildiği için eylemin içinde duramaz).
 *
 * Neden var: yazar "İncelemede · 3. sayfa" listesinden bir soru açıp
 * kaydedince eskiden süzgeçsiz listenin 1. sayfasına atılıyordu; yüz soruluk
 * bir inceleme turunda her soruda süzgeci yeniden kurmak demekti. Artık
 * listenin sorgusu `geri` parametresiyle taşınıyor ve kayıttan sonra aynı
 * yere dönülüyor.
 */

/**
 * Listenin anladığı süzgeçler. Başka hiçbir şey taşınmaz (açık yönlendirme yok).
 * `parti`: toplu içe aktarma kimliği (İçe aktarma geçmişi → "Soruları aç").
 */
const LISTE_ANAHTARLARI = ["ara", "konu", "durum", "eksik", "kazanim", "parti", "sayfa"] as const;

/** Ham sorgu dizesinden yalnızca liste süzgeçlerini süzer. */
export function listeSorgusu(raw: string | null | undefined): string {
  if (!raw) return "";
  const giris = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const cikis = new URLSearchParams();
  for (const k of LISTE_ANAHTARLARI) {
    const v = giris.get(k);
    if (v) cikis.set(k, v.slice(0, 200));
  }
  return cikis.toString();
}

/** Sayfanın searchParams nesnesinden (Next) liste sorgusu. */
export function listeSorgusuParams(sp: Record<string, string | string[] | undefined>): string {
  const u = new URLSearchParams();
  for (const k of LISTE_ANAHTARLARI) {
    const v = sp[k];
    if (typeof v === "string" && v) u.set(k, v);
  }
  return listeSorgusu(u.toString());
}

/** Listeye dönüş adresi; `ek` (ör. guncellendi=1) en sona eklenir. */
export function listeAdresi(sorgu: string, ek?: Record<string, string>): string {
  const u = new URLSearchParams(listeSorgusu(sorgu));
  for (const [k, v] of Object.entries(ek ?? {})) u.set(k, v);
  const s = u.toString();
  return "/checkup/sorular" + (s ? "?" + s : "");
}

/**
 * Soru ekranının adresi. Listeden geliniyorsa (`sorgu` verildiyse, boş olsa
 * bile) `?geri=` eklenir: soru ekranı hem dönüş adresini hem de önceki/sonraki
 * gezinmesinin hangi listeyi izleyeceğini buradan bilir. Süzgeçsiz liste de
 * bir listedir — boş `geri` "listeden geldim, süzgeç yok" demek.
 */
export function soruAdresi(id: string, sorgu?: string, ek?: Record<string, string>): string {
  const u = new URLSearchParams();
  if (sorgu !== undefined) u.set("geri", listeSorgusu(sorgu));
  for (const [k, v] of Object.entries(ek ?? {})) u.set(k, v);
  const s = u.toString();
  return "/checkup/sorular/" + encodeURIComponent(id) + (s ? "?" + s : "");
}
